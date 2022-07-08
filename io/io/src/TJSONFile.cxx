#pragma GCC diagnostic ignored "-Wunused-parameter"

// Author: Sergey Linev 8.07.2022

/*************************************************************************
 * Copyright (C) 1995-2022, Rene Brun and Fons Rademakers.               *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

//________________________________________________________________________
//
// The main motivation for the XML  format is to facilitate the
// communication with other non ROOT applications. Currently
// writing and reading XML files is limited to ROOT applications.
// It is our intention to develop a simple reader independent
// of the ROOT libraries that could be used as an example for
// real applications. One of possible approach with code generation
// is implemented in TXMLPlayer class.
//
// The XML format should be used only for small data volumes,
// typically histogram files, pictures, geometries, calibrations.
// The XML file is built in memory before being dumped to disk.
//
// Like for normal ROOT files, XML files use the same I/O mechanism
// exploiting the ROOT/CINT dictionary. Any class having a dictionary
// can be saved in XML format.
//
// This first implementation does not support subdirectories
// or Trees.
//
// The shared library libRXML.so may be loaded dynamically
// via gSystem->Load("libRXML"). This library is automatically
// loaded by the plugin manager as soon as a XML file is created
// via, eg
//   TFile::Open("file.xml","recreate");
// TFile::Open returns a TJSONFile object. When a XML file is open in write mode,
// one can use the normal TObject::Write to write an object in the file.
// Alternatively one can use the new functions TDirectoryFile::WriteObject and
// TDirectoryFile::WriteObjectAny to write a TObject* or any class not deriving
// from TObject.
//
// example of a session saving a histogram to a XML file
// =====================================================
//   TFile *f = TFile::Open("Example.xml","recreate");
//   TH1F *h = new TH1F("h","test",1000,-2,2);
//   h->FillRandom("gaus");
//   h->Write();
//   delete f;
//
// example of a session reading the histogram from the file
// ========================================================
//   TFile *f = TFile::Open("Example.xml");
//   TH1F *h = (TH1F*)f->Get("h");
//   h->Draw();
//
// A new option in the canvas "File" menu is available to save
// a TCanvas as a XML file. One can also do
//   canvas->Print("Example.xml");
//
// Configuring ROOT with the option "xml"
// ======================================
// The XML package is enabled by default
//
// documentation
// =============
// See also classes TBufferJSON, TKeyJSON
//
//______________________________________________________________________________

#include "TJSONFile.h"

#include "TROOT.h"
#include "TSystem.h"
#include "TList.h"
#include "TKeyJSON.h"
#include "TObjArray.h"
#include "TArrayC.h"
#include "TStreamerInfo.h"
#include "TStreamerElement.h"
#include "TProcessID.h"
#include "TError.h"
#include "TClass.h"
#include "TVirtualMutex.h"

#include <memory>

ClassImp(TJSONFile);


////////////////////////////////////////////////////////////////////////////////
/// Open or creates local XML file with name filename.
/// It is recommended to specify filename as "<file>.xml". The suffix ".xml"
/// will be used by object browsers to automatically identify the file as
/// a XML file. If the constructor fails in any way IsZombie() will
/// return true. Use IsOpen() to check if the file is (still) open.
///
/// If option = NEW or CREATE   create a new file and open it for writing,
///                             if the file already exists the file is
///                             not opened.
///           = RECREATE        create a new file, if the file already
///                             exists it will be overwritten.
///           = 2xoo            create a new file with specified xml settings
///                             for more details see TXMLSetup class
///           = UPDATE          open an existing file for writing.
///                             if no file exists, it is created.
///           = READ            open an existing file for reading.
///
/// For more details see comments for TFile::TFile() constructor
///
/// TJSONFile does not support TTree objects

TJSONFile::TJSONFile(const char *filename, Option_t *option, const char *title, Int_t compression)
{
   if (!gROOT)
      ::Fatal("TFile::TFile", "ROOT system not initialized");

   if (filename && !strncmp(filename, "xml:", 4))
      filename += 4;

   gDirectory = nullptr;
   SetName(filename);
   SetTitle(title);
   TDirectoryFile::Build(this, 0);

   fD = -1;
   fFile = this;
   fFree = nullptr;
   fVersion = gROOT->GetVersionInt(); // ROOT version in integer format
   fUnits = 4;
   fOption = option;
   SetCompressionSettings(compression);
   fWritten = 0;
   fSumBuffer = 0;
   fSum2Buffer = 0;
   fBytesRead = 0;
   fBytesWrite = 0;
   fClassIndex = 0;
   fSeekInfo = 0;
   fNbytesInfo = 0;
   fProcessIDs = nullptr;
   fNProcessIDs = 0;
   fIOVersion = TJSONFile::Class_Version();
   SetBit(kBinaryFile, kFALSE);

   fOption = option;
   fOption.ToUpper();

   if (fOption == "NEW")
      fOption = "CREATE";

   Bool_t create = (fOption == "CREATE") ? kTRUE : kFALSE;
   Bool_t recreate = (fOption == "RECREATE") ? kTRUE : kFALSE;
   Bool_t update = (fOption == "UPDATE") ? kTRUE : kFALSE;
   Bool_t read = (fOption == "READ") ? kTRUE : kFALSE;

   if (!create && !recreate && !update && !read) {
      read = kTRUE;
      fOption = "READ";
   }

   Bool_t devnull = kFALSE;
   const char *fname = nullptr;

   if (!filename || !filename[0]) {
      Error("TJSONFile", "file name is not specified");
      goto zombie;
   }

   // support dumping to /dev/null on UNIX
   if (!strcmp(filename, "/dev/null") && !gSystem->AccessPathName(filename, kWritePermission)) {
      devnull = kTRUE;
      create = kTRUE;
      recreate = kFALSE;
      update = kFALSE;
      read = kFALSE;
      fOption = "CREATE";
      SetBit(TFile::kDevNull);
   }

   gROOT->cd();

   fname = gSystem->ExpandPathName(filename);
   if (fname) {
      SetName(fname);
      delete[](char *) fname;
      fname = GetName();
   } else {
      Error("TJSONFile", "error expanding path %s", filename);
      goto zombie;
   }

   if (recreate) {
      if (!gSystem->AccessPathName(fname, kFileExists))
         gSystem->Unlink(fname);
      create = kTRUE;
      fOption = "CREATE";
   }

   if (create && !devnull && !gSystem->AccessPathName(fname, kFileExists)) {
      Error("TJSONFile", "file %s already exists", fname);
      goto zombie;
   }

   if (update) {
      if (gSystem->AccessPathName(fname, kFileExists)) {
         update = kFALSE;
         create = kTRUE;
      }
      if (update && gSystem->AccessPathName(fname, kWritePermission)) {
         Error("TJSONFile", "no write permission, could not open file %s", fname);
         goto zombie;
      }
   }

   if (read) {
      if (gSystem->AccessPathName(fname, kFileExists)) {
         Error("TJSONFile", "file %s does not exist", fname);
         goto zombie;
      }
      if (gSystem->AccessPathName(fname, kReadPermission)) {
         Error("TJSONFile", "no read permission, could not open file %s", fname);
         goto zombie;
      }
   }

   fRealName = fname;

   if (create || update)
      SetWritable(kTRUE);
   else
      SetWritable(kFALSE);

   InitJsonFile(create);

   return;

zombie:
   MakeZombie();
   gDirectory = gROOT;
}

////////////////////////////////////////////////////////////////////////////////
/// initialize json file and correspondent structures
/// identical to TFile::Init() function

void TJSONFile::InitJsonFile(Bool_t create)
{
   Int_t len = gROOT->GetListOfStreamerInfo()->GetSize() + 1;
   if (len < 5000)
      len = 5000;
   fClassIndex = new TArrayC(len);
   fClassIndex->Reset(0);

   if (create) {
      fDoc = nullptr;
      // fDoc = fXML->NewDoc();
      // XMLNodePointer_t fRootNode = fXML->NewChild(nullptr, nullptr, xmlio::Root);
      // fXML->DocSetRootElement(fDoc, fRootNode);
   } else {
      ReadFromFile();
   }

   {
      R__LOCKGUARD(gROOTMutex);
      gROOT->GetListOfFiles()->Add(this);
   }
   cd();

   fNProcessIDs = 0;
   TKey *key = nullptr;
   TIter iter(fKeys);
   while ((key = (TKey *)iter()) != nullptr) {
      if (!strcmp(key->GetClassName(), "TProcessID"))
         fNProcessIDs++;
   }

   fProcessIDs = new TObjArray(fNProcessIDs + 1);
}

////////////////////////////////////////////////////////////////////////////////
/// Close a XML file
/// For more comments see TFile::Close() function

void TJSONFile::Close(Option_t *option)
{
   if (!IsOpen())
      return;

   TString opt = option;
   if (opt.Length() > 0)
      opt.ToLower();

   if (IsWritable())
      SaveToFile();

   fWritable = kFALSE;

   if (fDoc) {
      // fXML->FreeDoc(fDoc);
      fDoc = nullptr;
   }

   if (fClassIndex) {
      delete fClassIndex;
      fClassIndex = nullptr;
   }

   if (fStreamerInfoNode) {
      // fXML->FreeNode(fStreamerInfoNode);
      fStreamerInfoNode = nullptr;
   }

   {
      TDirectory::TContext ctxt(this);
      // Delete all supported directories structures from memory
      TDirectoryFile::Close();
   }

   // delete the TProcessIDs
   TList pidDeleted;
   TIter next(fProcessIDs);
   TProcessID *pid;
   while ((pid = (TProcessID *)next())) {
      if (!pid->DecrementCount()) {
         if (pid != TProcessID::GetSessionProcessID())
            pidDeleted.Add(pid);
      } else if (opt.Contains("r")) {
         pid->Clear();
      }
   }
   pidDeleted.Delete();

   R__LOCKGUARD(gROOTMutex);
   gROOT->GetListOfFiles()->Remove(this);
}

////////////////////////////////////////////////////////////////////////////////
/// destructor of TJSONFile object

TJSONFile::~TJSONFile()
{
   Close();
}

////////////////////////////////////////////////////////////////////////////////
/// return kTRUE if file is opened and can be accessed

Bool_t TJSONFile::IsOpen() const
{
   return fDoc != nullptr;
}

////////////////////////////////////////////////////////////////////////////////
/// Reopen a file with a different access mode, like from READ to
/// See TFile::Open() for details

Int_t TJSONFile::ReOpen(Option_t *mode)
{
   cd();

   TString opt = mode;
   opt.ToUpper();

   if (opt != "READ" && opt != "UPDATE") {
      Error("ReOpen", "mode must be either READ or UPDATE, not %s", opt.Data());
      return 1;
   }

   if (opt == fOption || (opt == "UPDATE" && fOption == "CREATE"))
      return 1;

   if (opt == "READ") {
      // switch to READ mode

      if (IsOpen() && IsWritable())
         SaveToFile();
      fOption = opt;

      SetWritable(kFALSE);

   } else {
      fOption = opt;

      SetWritable(kTRUE);
   }

   return 0;
}

////////////////////////////////////////////////////////////////////////////////
/// create XML key, which will store object in xml structures

TKey *TJSONFile::CreateKey(TDirectory *mother, const TObject *obj, const char *name, Int_t)
{
   return new TKeyJSON(mother, ++fKeyCounter, obj, name);
}

////////////////////////////////////////////////////////////////////////////////
/// create XML key, which will store object in xml structures

TKey *TJSONFile::CreateKey(TDirectory *mother, const void *obj, const TClass *cl, const char *name, Int_t)
{
   return new TKeyJSON(mother, ++fKeyCounter, obj, cl, name);
}

////////////////////////////////////////////////////////////////////////////////
/// function produces pair of xml and dtd file names

void TJSONFile::ProduceFileNames(const char *filename, TString &fname)
{
   fname = filename;

   Bool_t hasjsonext = kFALSE;

   if (fname.Length() > 5) {
      TString last = fname(fname.Length() - 5, 5);
      last.ToLower();
      hasjsonext = (last == ".json");
   }

   if (!hasjsonext)
      fname += ".json";
}

////////////////////////////////////////////////////////////////////////////////
/// Saves xml structures to the file
/// xml elements are kept in list of TKeyJSON objects
/// When saving, all this elements are linked to root xml node
/// At the end StreamerInfo structures are added
/// After xml document is saved, all nodes will be unlinked from root node
/// and kept in memory.
/// Only Close() or destructor release memory, used by xml structures

void TJSONFile::SaveToFile()
{
   if (!fDoc)
      return;

   if (gDebug > 1)
      Info("SaveToFile", "File: %s", fRealName.Data());

   /*

   XMLNodePointer_t fRootNode = fXML->DocGetRootElement(fDoc);

   fXML->FreeAttr(fRootNode, xmlio::Setup);
   fXML->NewAttr(fRootNode, nullptr, xmlio::Setup, GetSetupAsString());

   fXML->FreeAttr(fRootNode, xmlio::Ref);
   fXML->NewAttr(fRootNode, nullptr, xmlio::Ref, xmlio::Null);

   if (GetIOVersion() > 1) {

      fXML->FreeAttr(fRootNode, xmlio::CreateTm);
      if (TestBit(TFile::kReproducible))
         fXML->NewAttr(fRootNode, nullptr, xmlio::CreateTm, TDatime((UInt_t) 1).AsSQLString());
      else
         fXML->NewAttr(fRootNode, nullptr, xmlio::CreateTm, fDatimeC.AsSQLString());

      fXML->FreeAttr(fRootNode, xmlio::ModifyTm);
      if (TestBit(TFile::kReproducible))
         fXML->NewAttr(fRootNode, nullptr, xmlio::ModifyTm, TDatime((UInt_t) 1).AsSQLString());
      else
         fXML->NewAttr(fRootNode, nullptr, xmlio::ModifyTm, fDatimeM.AsSQLString());

      fXML->FreeAttr(fRootNode, xmlio::ObjectUUID);
      if (TestBit(TFile::kReproducible))
         fXML->NewAttr(fRootNode, nullptr, xmlio::ObjectUUID, TUUID("00000000-0000-0000-0000-000000000000").AsString());
      else
         fXML->NewAttr(fRootNode, nullptr, xmlio::ObjectUUID, fUUID.AsString());

      fXML->FreeAttr(fRootNode, xmlio::Title);
      if (strlen(GetTitle()) > 0)
         fXML->NewAttr(fRootNode, nullptr, xmlio::Title, GetTitle());

      fXML->FreeAttr(fRootNode, xmlio::IOVersion);
      fXML->NewIntAttr(fRootNode, xmlio::IOVersion, GetIOVersion());

      fXML->FreeAttr(fRootNode, "file_version");
      fXML->NewIntAttr(fRootNode, "file_version", fVersion);
   }

   TString fname;
   ProduceFileNames(fRealName, fname);

   CombineNodesTree(this, fRootNode, kTRUE);

   WriteStreamerInfo();


   if (fStreamerInfoNode)
      fXML->AddChild(fRootNode, fStreamerInfoNode);

   Int_t layout = GetCompressionLevel() > 5 ? 0 : 1;

   fXML->SaveDoc(fDoc, fname, layout);

   CombineNodesTree(this, fRootNode, kFALSE);

   if (fStreamerInfoNode)
      fXML->UnlinkNode(fStreamerInfoNode);

*/
}

////////////////////////////////////////////////////////////////////////////////
/// Connect/disconnect all file nodes to single tree before/after saving

void TJSONFile::CombineNodesTree(TDirectory *dir, void *topnode, Bool_t dolink)
{
   if (!dir)
      return;

/*
   TIter iter(dir->GetListOfKeys());
   TKeyJSON *key = nullptr;

   while ((key = (TKeyJSON *)iter()) != nullptr) {
      if (dolink)
         fXML->AddChild(topnode, key->KeyNode());
      else
         fXML->UnlinkNode(key->KeyNode());
      if (key->IsSubdir())
         CombineNodesTree(FindKeyDir(dir, key->GetKeyId()), key->KeyNode(), dolink);
   }
*/
}

////////////////////////////////////////////////////////////////////////////////
/// read document from file
/// Now full content of document reads into the memory
/// Then document decomposed to separate keys and streamer info structures
/// All irrelevant data will be cleaned

Bool_t TJSONFile::ReadFromFile()
{
   return kFALSE;

/*
   fDoc = fXML->ParseFile(fRealName);
   if (!fDoc)
      return kFALSE;

   XMLNodePointer_t fRootNode = fXML->DocGetRootElement(fDoc);

   if (!fRootNode || !fXML->ValidateVersion(fDoc)) {
      fXML->FreeDoc(fDoc);
      fDoc = nullptr;
      return kFALSE;
   }

   ReadSetupFromStr(fXML->GetAttr(fRootNode, xmlio::Setup));

   if (fXML->HasAttr(fRootNode, xmlio::CreateTm)) {
      TDatime tm(fXML->GetAttr(fRootNode, xmlio::CreateTm));
      fDatimeC = tm;
   }

   if (fXML->HasAttr(fRootNode, xmlio::ModifyTm)) {
      TDatime tm(fXML->GetAttr(fRootNode, xmlio::ModifyTm));
      fDatimeM = tm;
   }

   if (fXML->HasAttr(fRootNode, xmlio::ObjectUUID)) {
      TUUID id(fXML->GetAttr(fRootNode, xmlio::ObjectUUID));
      fUUID = id;
   }

   if (fXML->HasAttr(fRootNode, xmlio::Title))
      SetTitle(fXML->GetAttr(fRootNode, xmlio::Title));

   if (fXML->HasAttr(fRootNode, xmlio::IOVersion))
      fIOVersion = fXML->GetIntAttr(fRootNode, xmlio::IOVersion);
   else
      fIOVersion = 1;

   if (fXML->HasAttr(fRootNode, "file_version"))
      fVersion = fXML->GetIntAttr(fRootNode, "file_version");

   fStreamerInfoNode = fXML->GetChild(fRootNode);
   fXML->SkipEmpty(fStreamerInfoNode);
   while (fStreamerInfoNode) {
      if (strcmp(xmlio::SInfos, fXML->GetNodeName(fStreamerInfoNode)) == 0)
         break;
      fXML->ShiftToNext(fStreamerInfoNode);
   }
   fXML->UnlinkNode(fStreamerInfoNode);

   if (fStreamerInfoNode)
      ReadStreamerInfo();

   if (IsUseDtd())
      if (!fXML->ValidateDocument(fDoc, gDebug > 0)) {
         fXML->FreeDoc(fDoc);
         fDoc = nullptr;
         return kFALSE;
      }

   ReadKeysList(this, fRootNode);

   fXML->CleanNode(fRootNode);

   return kTRUE;
*/
}

////////////////////////////////////////////////////////////////////////////////
/// Read list of keys for directory

Int_t TJSONFile::ReadKeysList(TDirectory *dir, void *topnode)
{
   if (!dir || !topnode)
      return 0;

   return 0;

/*   Int_t nkeys = 0;

   XMLNodePointer_t keynode = fXML->GetChild(topnode);
   fXML->SkipEmpty(keynode);
   while (keynode) {
      XMLNodePointer_t next = fXML->GetNext(keynode);

      if (strcmp(xmlio::Xmlkey, fXML->GetNodeName(keynode)) == 0) {
         fXML->UnlinkNode(keynode);

         TKeyJSON *key = new TKeyJSON(dir, ++fKeyCounter, keynode);
         dir->AppendKey(key);

         if (gDebug > 2)
            Info("ReadKeysList", "Add key %s from node %s", key->GetName(), fXML->GetNodeName(keynode));

         nkeys++;
      }

      keynode = next;
      fXML->SkipEmpty(keynode);
   }

   return nkeys;
*/
}

////////////////////////////////////////////////////////////////////////////////
/// convert all TStreamerInfo, used in file, to xml format

void TJSONFile::WriteStreamerInfo()
{
   if (fStreamerInfoNode) {
      // fXML->FreeNode(fStreamerInfoNode);
      fStreamerInfoNode = nullptr;
   }

   if (!IsStoreStreamerInfos())
      return;

   TObjArray list;

   TIter iter(gROOT->GetListOfStreamerInfo());

   TStreamerInfo *info = nullptr;

   while ((info = (TStreamerInfo *)iter()) != nullptr) {
      Int_t uid = info->GetNumber();
      if (fClassIndex->fArray[uid])
         list.Add(info);
   }

   if (list.GetSize() == 0)
      return;

   /*
   fStreamerInfoNode = fXML->NewChild(nullptr, nullptr, xmlio::SInfos);
   for (int n = 0; n <= list.GetLast(); n++) {
      info = (TStreamerInfo *)list.At(n);

      XMLNodePointer_t infonode = fXML->NewChild(fStreamerInfoNode, nullptr, "TStreamerInfo");

      fXML->NewAttr(infonode, nullptr, "name", info->GetName());
      fXML->NewAttr(infonode, nullptr, "title", info->GetTitle());

      fXML->NewIntAttr(infonode, "v", info->IsA()->GetClassVersion());
      fXML->NewIntAttr(infonode, "classversion", info->GetClassVersion());
      fXML->NewAttr(infonode, nullptr, "canoptimize",
                    (info->TestBit(TStreamerInfo::kCannotOptimize) ? xmlio::False : xmlio::True));
      fXML->NewIntAttr(infonode, "checksum", info->GetCheckSum());

      TIter iter2(info->GetElements());
      TStreamerElement *elem = nullptr;
      while ((elem = (TStreamerElement *)iter2()) != nullptr)
         StoreStreamerElement(infonode, elem);
   }
   */
}

////////////////////////////////////////////////////////////////////////////////
/// Read streamerinfo structures from xml format and provide them in the list
/// It is user responsibility to destroy this list

TFile::InfoListRet TJSONFile::GetStreamerInfoListImpl(bool /* lookupSICache */)
{
   ROOT::Internal::RConcurrentHashColl::HashValue hash;

   if (!fStreamerInfoNode)
      return {nullptr, 1, hash};

   TList *list = new TList();

/*
   XMLNodePointer_t sinfonode = fXML->GetChild(fStreamerInfoNode);
   fXML->SkipEmpty(sinfonode);

   while (sinfonode) {
      if (strcmp("TStreamerInfo", fXML->GetNodeName(sinfonode)) == 0) {
         TString fname = fXML->GetAttr(sinfonode, "name");
         TString ftitle = fXML->GetAttr(sinfonode, "title");

         TStreamerInfo *info = new TStreamerInfo(TClass::GetClass(fname));
         info->SetTitle(ftitle);

         list->Add(info);

         Int_t clversion = AtoI(fXML->GetAttr(sinfonode, "classversion"));
         info->SetClassVersion(clversion);
         info->SetOnFileClassVersion(clversion);
         Int_t checksum = AtoI(fXML->GetAttr(sinfonode, "checksum"));
         info->SetCheckSum(checksum);

         const char *canoptimize = fXML->GetAttr(sinfonode, "canoptimize");
         if (!canoptimize || (strcmp(canoptimize, xmlio::False) == 0))
            info->SetBit(TStreamerInfo::kCannotOptimize);
         else
            info->ResetBit(TStreamerInfo::kCannotOptimize);

         XMLNodePointer_t node = fXML->GetChild(sinfonode);
         fXML->SkipEmpty(node);
         while (node) {
            ReadStreamerElement(node, info);
            fXML->ShiftToNext(node);
         }
      }
      fXML->ShiftToNext(sinfonode);
   }
*/
   list->SetOwner();

   return {list, 0, hash};
}

////////////////////////////////////////////////////////////////////////////////
/// store data of single TStreamerElement in streamer node

void TJSONFile::StoreStreamerElement(void *infonode, TStreamerElement *elem)
{
   /*
   TClass *cl = elem->IsA();

   XMLNodePointer_t node = fXML->NewChild(infonode, nullptr, cl->GetName());

   char sbuf[100], namebuf[100];

   fXML->NewAttr(node, nullptr, "name", elem->GetName());
   if (strlen(elem->GetTitle()) > 0)
      fXML->NewAttr(node, nullptr, "title", elem->GetTitle());

   fXML->NewIntAttr(node, "v", cl->GetClassVersion());

   fXML->NewIntAttr(node, "type", elem->GetType());

   if (strlen(elem->GetTypeName()) > 0)
      fXML->NewAttr(node, nullptr, "typename", elem->GetTypeName());

   fXML->NewIntAttr(node, "size", elem->GetSize());

   if (elem->GetArrayDim() > 0) {
      fXML->NewIntAttr(node, "numdim", elem->GetArrayDim());

      for (int ndim = 0; ndim < elem->GetArrayDim(); ndim++) {
         sprintf(namebuf, "dim%d", ndim);
         fXML->NewIntAttr(node, namebuf, elem->GetMaxIndex(ndim));
      }
   }

   if (cl == TStreamerBase::Class()) {
      TStreamerBase *base = (TStreamerBase *)elem;
      sprintf(sbuf, "%d", base->GetBaseVersion());
      fXML->NewAttr(node, nullptr, "baseversion", sbuf);
      sprintf(sbuf, "%d", base->GetBaseCheckSum());
      fXML->NewAttr(node, nullptr, "basechecksum", sbuf);
   } else if (cl == TStreamerBasicPointer::Class()) {
      TStreamerBasicPointer *bptr = (TStreamerBasicPointer *)elem;
      fXML->NewIntAttr(node, "countversion", bptr->GetCountVersion());
      fXML->NewAttr(node, nullptr, "countname", bptr->GetCountName());
      fXML->NewAttr(node, nullptr, "countclass", bptr->GetCountClass());
   } else if (cl == TStreamerLoop::Class()) {
      TStreamerLoop *loop = (TStreamerLoop *)elem;
      fXML->NewIntAttr(node, "countversion", loop->GetCountVersion());
      fXML->NewAttr(node, nullptr, "countname", loop->GetCountName());
      fXML->NewAttr(node, nullptr, "countclass", loop->GetCountClass());
   } else if ((cl == TStreamerSTL::Class()) || (cl == TStreamerSTLstring::Class())) {
      TStreamerSTL *stl = (TStreamerSTL *)elem;
      fXML->NewIntAttr(node, "STLtype", stl->GetSTLtype());
      fXML->NewIntAttr(node, "Ctype", stl->GetCtype());
   }
*/
}

////////////////////////////////////////////////////////////////////////////////
/// read and reconstruct single TStreamerElement from xml node

void TJSONFile::ReadStreamerElement(void *node, TStreamerInfo *info)
{
/*

   TClass *cl = TClass::GetClass(fXML->GetNodeName(node));
   if (!cl || !cl->InheritsFrom(TStreamerElement::Class()))
      return;

   TStreamerElement *elem = (TStreamerElement *)cl->New();

   int elem_type = fXML->GetIntAttr(node, "type");

   elem->SetName(fXML->GetAttr(node, "name"));
   elem->SetTitle(fXML->GetAttr(node, "title"));
   elem->SetType(elem_type);
   elem->SetTypeName(fXML->GetAttr(node, "typename"));
   elem->SetSize(fXML->GetIntAttr(node, "size"));

   if (cl == TStreamerBase::Class()) {
      int basever = fXML->GetIntAttr(node, "baseversion");
      ((TStreamerBase *)elem)->SetBaseVersion(basever);
      Int_t baseCheckSum = fXML->GetIntAttr(node, "basechecksum");
      ((TStreamerBase *)elem)->SetBaseCheckSum(baseCheckSum);
   } else if (cl == TStreamerBasicPointer::Class()) {
      TString countname = fXML->GetAttr(node, "countname");
      TString countclass = fXML->GetAttr(node, "countclass");
      Int_t countversion = fXML->GetIntAttr(node, "countversion");

      ((TStreamerBasicPointer *)elem)->SetCountVersion(countversion);
      ((TStreamerBasicPointer *)elem)->SetCountName(countname);
      ((TStreamerBasicPointer *)elem)->SetCountClass(countclass);
   } else if (cl == TStreamerLoop::Class()) {
      TString countname = fXML->GetAttr(node, "countname");
      TString countclass = fXML->GetAttr(node, "countclass");
      Int_t countversion = fXML->GetIntAttr(node, "countversion");
      ((TStreamerLoop *)elem)->SetCountVersion(countversion);
      ((TStreamerLoop *)elem)->SetCountName(countname);
      ((TStreamerLoop *)elem)->SetCountClass(countclass);
   } else if ((cl == TStreamerSTL::Class()) || (cl == TStreamerSTLstring::Class())) {
      int fSTLtype = fXML->GetIntAttr(node, "STLtype");
      int fCtype = fXML->GetIntAttr(node, "Ctype");
      ((TStreamerSTL *)elem)->SetSTLtype(fSTLtype);
      ((TStreamerSTL *)elem)->SetCtype(fCtype);
   }

   char namebuf[100];

   if (fXML->HasAttr(node, "numdim")) {
      int numdim = fXML->GetIntAttr(node, "numdim");
      elem->SetArrayDim(numdim);
      for (int ndim = 0; ndim < numdim; ndim++) {
         sprintf(namebuf, "dim%d", ndim);
         int maxi = fXML->GetIntAttr(node, namebuf);
         elem->SetMaxIndex(ndim, maxi);
      }
   }

   elem->SetType(elem_type);
   elem->SetNewType(elem_type);

   info->GetElements()->Add(elem);
*/
}

////////////////////////////////////////////////////////////////////////////////
/// If true, all correspondent to file TStreamerInfo objects will be stored in file
/// this allows to apply schema evolution later for this file
/// may be useful, when file used outside ROOT and TStreamerInfo objects does not required
/// Can be changed only for newly created file.

void TJSONFile::SetStoreStreamerInfos(Bool_t store)
{
   if (IsWritable() && (GetListOfKeys()->GetSize() == 0))
      fStoreStreamerInfos = store;
}

////////////////////////////////////////////////////////////////////////////////
/// Create key for directory entry in the key

Long64_t TJSONFile::DirCreateEntry(TDirectory *dir)
{
   TDirectory *mother = dir->GetMotherDir();
   if (!mother)
      mother = this;

   TKeyJSON *key = new TKeyJSON(mother, ++fKeyCounter, dir, dir->GetName(), dir->GetTitle());

   key->SetSubir();

   return key->GetKeyId();
}

////////////////////////////////////////////////////////////////////////////////
/// Search for key which correspond to directory dir

TKeyJSON *TJSONFile::FindDirKey(TDirectory *dir)
{
   TDirectory *motherdir = dir->GetMotherDir();
   if (!motherdir)
      motherdir = this;

   TIter next(motherdir->GetListOfKeys());
   TObject *obj = nullptr;

   while ((obj = next()) != nullptr) {
      TKeyJSON *key = dynamic_cast<TKeyJSON *>(obj);

      if (key)
         if (key->GetKeyId() == dir->GetSeekDir())
            return key;
   }

   return nullptr;
}

////////////////////////////////////////////////////////////////////////////////
/// Find a directory in motherdir with a seek equal to keyid

TDirectory *TJSONFile::FindKeyDir(TDirectory *motherdir, Long64_t keyid)
{
   if (!motherdir)
      motherdir = this;

   TIter next(motherdir->GetList());
   TObject *obj = nullptr;

   while ((obj = next()) != nullptr) {
      TDirectory *dir = dynamic_cast<TDirectory *>(obj);
      if (dir)
         if (dir->GetSeekDir() == keyid)
            return dir;
   }

   return nullptr;
}

////////////////////////////////////////////////////////////////////////////////
/// Read keys for directory
/// Make sense only once, while next time no new subnodes will be created

Int_t TJSONFile::DirReadKeys(TDirectory *dir)
{
   TKeyJSON *key = FindDirKey(dir);
   if (!key)
      return 0;

   return ReadKeysList(dir, key->KeyNode());
}

////////////////////////////////////////////////////////////////////////////////
/// Update key attributes

void TJSONFile::DirWriteKeys(TDirectory *)
{
   TIter next(GetListOfKeys());
   TObject *obj = nullptr;

   while ((obj = next()) != nullptr) {
      TKeyJSON *key = dynamic_cast<TKeyJSON *>(obj);
      if (key)
         key->UpdateAttributes();
   }
}

////////////////////////////////////////////////////////////////////////////////
/// Write the directory header

void TJSONFile::DirWriteHeader(TDirectory *dir)
{
   TKeyJSON *key = FindDirKey(dir);
   if (key)
      key->UpdateObject(dir);
}
