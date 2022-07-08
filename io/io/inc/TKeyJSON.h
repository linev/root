// Author: Sergey Linev  8.07.2022

/*************************************************************************
 * Copyright (C) 1995-2022, Rene Brun and Fons Rademakers.               *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

#ifndef ROOT_TKeyJSON
#define ROOT_TKeyJSON

#include "TKey.h"

class TXMLFile;

class TKeyJSON final : public TKey {

private:
   TKeyJSON(const TKeyJSON &) = delete;            // TKeyJSON objects are not copiable.
   TKeyJSON &operator=(const TKeyJSON &) = delete; // TKeyJSON objects are not copiable.

protected:
   TKeyJSON() {} // NOLINT: not allowed to use = default because of TObject::kIsOnHeap detection, see ROOT-10300

public:
   TKeyJSON(TDirectory *mother, Long64_t keyid, const TObject *obj, const char *name = nullptr,
           const char *title = nullptr);
   TKeyJSON(TDirectory *mother, Long64_t keyid, const void *obj, const TClass *cl, const char *name,
           const char *title = nullptr);
   TKeyJSON(TDirectory *mother, Long64_t keyid, void *keynode);
   virtual ~TKeyJSON();

   // redefined TKey Methods
   void Delete(Option_t *option = "") final;
   void DeleteBuffer() final {}
   void FillBuffer(char *&) final {}
   char *GetBuffer() const final { return nullptr; }
   Long64_t GetSeekKey() const final { return fKeyNode ? 1024 : 0; }
   Long64_t GetSeekPdir() const final { return fKeyNode ? 1024 : 0; }
   // virtual ULong_t   Hash() const { return 0; }
   void Keep() final {}
   // virtual void      ls(Option_t* ="") const;
   // virtual void      Print(Option_t* ="") const {}

   Int_t Read(TObject *tobj) final;
   TObject *ReadObj() final;
   TObject *ReadObjWithBuffer(char *bufferRead) final;
   void *ReadObjectAny(const TClass *expectedClass) final;

   void ReadBuffer(char *&) final {}
   Bool_t ReadFile() final { return kTRUE; }
   void SetBuffer() final { fBuffer = nullptr; }
   Int_t WriteFile(Int_t = 1, TFile * = nullptr) final { return 0; }

   // TKeyJSON specific methods

   void *KeyNode() const { return fKeyNode; }
   Long64_t GetKeyId() const { return fKeyId; }
   Bool_t IsSubdir() const { return fSubdir; }
   void SetSubir() { fSubdir = kTRUE; }
   void UpdateObject(TObject *obj);
   void UpdateAttributes();

protected:
   Int_t Read(const char *name) final { return TKey::Read(name); }
   void StoreObject(const void *obj, const TClass *cl, Bool_t check_tobj = kFALSE);
   void StoreKeyAttributes();

   void *JsonReadAny(void *obj, const TClass *expectedClass);

   void *fKeyNode{nullptr};          //! JSON node with stored object
   Long64_t fKeyId{0};               //! unique identifier of key for search methods
   Bool_t fSubdir{kFALSE};           //! indicates that key contains subdirectory

   ClassDefOverride(TKeyJSON, 0)    // a special TKey for XML files
};

#endif
