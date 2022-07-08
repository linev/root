// Author: Sergey Linev  8.07.2022

/*************************************************************************
 * Copyright (C) 1995-2022, Rene Brun and Fons Rademakers.               *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

#ifndef ROOT_TJSONFile
#define ROOT_TJSONFile

#include "TFile.h"
#include "Compression.h"
#include <memory>

class TKeyJSON;
class TStreamerElement;
class TStreamerInfo;

class TJSONFile final : public TFile {

protected:
   void InitJsonFile(Bool_t create);
   // Interface to basic system I/O routines
   Int_t SysOpen(const char *, Int_t, UInt_t) final { return 0; }
   Int_t SysClose(Int_t) final { return 0; }
   Int_t SysRead(Int_t, void *, Int_t) final { return 0; }
   Int_t SysWrite(Int_t, const void *, Int_t) final { return 0; }
   Long64_t SysSeek(Int_t, Long64_t, Int_t) final { return 0; }
   Int_t SysStat(Int_t, Long_t *, Long64_t *, Long_t *, Long_t *) final { return 0; }
   Int_t SysSync(Int_t) final { return 0; }

   // Overwrite methods for directory I/O
   Long64_t DirCreateEntry(TDirectory *) final;
   Int_t DirReadKeys(TDirectory *) final;
   void DirWriteKeys(TDirectory *) final;
   void DirWriteHeader(TDirectory *) final;

   InfoListRet GetStreamerInfoListImpl(bool lookupSICache) final;

private:
   TJSONFile(const TJSONFile &) = delete;            // TJSONFile cannot be copied, not implemented
   void operator=(const TJSONFile &) = delete;      // TJSONFile cannot be copied, not implemented

public:
   TJSONFile() {} // NOLINT: not allowed to use = default because of TObject::kIsOnHeap detection, see ROOT-10300
   TJSONFile(const char *filename, Option_t *option = "read", const char *title = "title", Int_t compression = ROOT::RCompressionSetting::EDefaults::kUseCompiledDefault);
   virtual ~TJSONFile();

   void Close(Option_t *option = "") final; // *MENU*
   TKey *CreateKey(TDirectory *mother, const TObject *obj, const char *name, Int_t bufsize) final;
   TKey *CreateKey(TDirectory *mother, const void *obj, const TClass *cl, const char *name, Int_t bufsize) final;
   void DrawMap(const char * = "*", Option_t * = "") final {}
   void FillBuffer(char *&) final {}
   void Flush() final {}

   Long64_t GetEND() const final { return 0; }
   Int_t GetErrno() const final { return 0; }
   void ResetErrno() const final {}

   Int_t GetNfree() const final { return 0; }
   Int_t GetNbytesInfo() const final { return 0; }
   Int_t GetNbytesFree() const final { return 0; }
   Long64_t GetSeekFree() const final { return 0; }
   Long64_t GetSeekInfo() const final { return 0; }
   Long64_t GetSize() const final { return 0; }

   Int_t GetIOVersion() const { return fIOVersion; }

   Bool_t IsOpen() const final;

   void MakeFree(Long64_t, Long64_t) final {}
   void MakeProject(const char *, const char * = "*", Option_t * = "new") final {} // *MENU*
   void Map(Option_t *) final {}                                                   //
   void Map() final {}                                                             //
   void Paint(Option_t * = "") final {}
   void Print(Option_t * = "") const final {}
   Bool_t ReadBuffer(char *, Int_t) final { return kFALSE; }
   Bool_t ReadBuffer(char *, Long64_t, Int_t) final { return kFALSE; }
   void ReadFree() final {}
   Int_t Recover() final { return 0; }
   Int_t ReOpen(Option_t *mode) final;
   void Seek(Long64_t, ERelativeTo = kBeg) final {}

   void SetEND(Long64_t) final {}
   Int_t Sizeof() const final { return 0; }

   Bool_t WriteBuffer(const char *, Int_t) final { return kFALSE; }
   Int_t Write(const char * = nullptr, Int_t = 0, Int_t = 0) final { return 0; }
   Int_t Write(const char * = nullptr, Int_t = 0, Int_t = 0) const final { return 0; }
   void WriteFree() final {}
   void WriteHeader() final {}
   void WriteStreamerInfo() final;

   void SetStoreStreamerInfos(Bool_t iConvert = kTRUE);
   Bool_t IsStoreStreamerInfos() const { return fStoreStreamerInfos; }

protected:
   // functions to store streamer infos

   void StoreStreamerElement(void *node, TStreamerElement *elem);
   void ReadStreamerElement(void *node, TStreamerInfo *info);

   Bool_t ReadFromFile();
   Int_t ReadKeysList(TDirectory *dir, void *topnode);
   TKeyJSON *FindDirKey(TDirectory *dir);
   TDirectory *FindKeyDir(TDirectory *mother, Long64_t keyid);
   void CombineNodesTree(TDirectory *dir, void *topnode, Bool_t dolink);

   void SaveToFile();

   static void ProduceFileNames(const char *filename, TString &fname);

   void *fDoc{nullptr}; //! JSON document

   void *fStreamerInfoNode{nullptr}; //!  pointer of node with streamer info data

   Bool_t fStoreStreamerInfos{kTRUE};  //! should streamer infos stored in JSON file

   Int_t fIOVersion{0}; //! indicates format of ROOT xml file

   Long64_t fKeyCounter{0}; //! counter of created keys, used for keys id

   ClassDefOverride(TJSONFile, 0) // ROOT file in JSON format
};

#endif
