/*************************************************************************
 * Copyright (C) 1995-2019, Rene Brun and Fons Rademakers.               *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

#include "ROOT/RBrowsable.hxx"

#include "ROOT/RLogger.hxx"

#include "TClass.h"
#include "TBufferJSON.h"

#include <algorithm>

using namespace ROOT::Experimental;
using namespace ROOT::Experimental::Browsable;
using namespace std::string_literals;


std::string RProvider::GetClassIcon(const std::string &classname)
{
   if (classname == "TTree" || classname == "TNtuple")
      return "sap-icon://tree"s;
   if (classname == "TDirectory" || classname == "TDirectoryFile")
      return "sap-icon://folder-blank"s;
   if (classname.find("TLeaf") == 0)
      return "sap-icon://e-care"s;

   return "sap-icon://electronic-medical-record"s;
}


RProvider::BrowseMap_t &RProvider::GetBrowseMap()
{
   static RProvider::BrowseMap_t sMap;
   return sMap;
}

RProvider::FileMap_t &RProvider::GetFileMap()
{
   static RProvider::FileMap_t sMap;
   return sMap;
}


RProvider::~RProvider()
{
   // here to remove all correspondent entries
   auto &fmap = GetFileMap();

   for (auto fiter = fmap.begin();fiter != fmap.end();) {
      if (fiter->second.provider == this)
         fiter = fmap.erase(fiter);
      else
         fiter++;
   }

   auto &bmap = GetBrowseMap();
   for (auto biter = bmap.begin(); biter != bmap.end();) {
      if (biter->second.provider == this)
         biter = bmap.erase(biter);
      else
         biter++;
   }
}


void RProvider::RegisterFile(const std::string &extension, FileFunc_t func)
{
    auto &fmap = GetFileMap();

    if ((extension != "*") && (fmap.find(extension) != fmap.end()))
       R__ERROR_HERE("Browserv7") << "Provider for file extension  " << extension << " already exists";

    fmap.emplace(extension, StructFile{this,func});
}

void RProvider::RegisterBrowse(const TClass *cl, BrowseFunc_t func)
{
    auto &bmap = GetBrowseMap();

    if (cl && (bmap.find(cl) != bmap.end()))
       R__ERROR_HERE("Browserv7") << "Browse provider for class " << cl->GetName() << " already exists";

    bmap.emplace(cl, StructBrowse{this,func});
}


//////////////////////////////////////////////////////////////////////////////////
// remove provider from all registered lists


std::shared_ptr<RElement> RProvider::OpenFile(const std::string &extension, const std::string &fullname)
{
   auto &fmap = GetFileMap();

   auto iter = fmap.find(extension);

   if (iter != fmap.end()) {
      auto res = iter->second.func(fullname);
      if (res) return res;
   }

   for (auto &pair : fmap)
      if ((pair.first == "*") || (pair.first == extension)) {
         auto res = pair.second.func(fullname);
         if (res) return res;
      }

   return nullptr;
}


/////////////////////////////////////////////////////////////////////////
/// Create browsable element for the object
/// Created element may take ownership over the object

std::shared_ptr<RElement> RProvider::Browse(std::unique_ptr<Browsable::RHolder> &object)
{
   auto &bmap = GetBrowseMap();

   auto cl = object->GetClass();

   auto iter = bmap.find(cl);

   if (iter != bmap.end()) {
      auto res = iter->second.func(object);
      if (res || !object) return res;
   }

   for (auto &pair : bmap)
      if ((pair.first == nullptr) || (pair.first == cl)) {
         auto res = pair.second.func(object);
         if (res || !object) return res;
      }

   return nullptr;
}

/////////////////////////////////////////////////////////////////////
/// Find item with specified name
/// Default implementation, should work for all

bool RLevelIter::Find(const std::string &name)
{
   if (!Reset()) return false;

   while (Next()) {
      if (GetName() == name)
         return true;
   }

   return false;
}


/////////////////////////////////////////////////////////////////////
/// Sort created items

void RLevelIter::Sort(std::vector<std::unique_ptr<RBrowserItem>> &vect, const std::string &method)
{
   if (method.empty()) {
      bool is_folder{false}, is_nonfolder{false};

      for (auto &item : vect)
         if (item->IsFolder()) is_folder = true; else is_nonfolder = true;

      // just move folders to the top
      if (is_folder && is_nonfolder) {
         std::vector<std::unique_ptr<RBrowserItem>> vect0;
         std::swap(vect, vect0);

         for (auto &&item : vect0)
            if (item->IsFolder())
               vect.emplace_back(std::move(item));

         for (auto &&item : vect0)
            if (item)
               vect.emplace_back(std::move(item));
      }
   } else if (method != "unsorted") {
      std::sort(vect.begin(), vect.end(), [](const std::unique_ptr<RBrowserItem> &a, const std::unique_ptr<RBrowserItem> &b) {
         // directory listed always as first
         if (a->IsFolder() != b->IsFolder())
            return a->IsFolder();

         return a->GetName() < b->GetName();
      });
   }
}

/////////////////////////////////////////////////////////////////////
/// set top item

void RBrowsable::SetTopItem(std::shared_ptr<Browsable::RElement> item)
{
   fLevels.clear();
   fLevels.emplace_back("");
   fLevels.front().item = item;
}

/////////////////////////////////////////////////////////////////////
/// Navigate to the top level

bool RBrowsable::ResetLevels()
{
   while (fLevels.size() > 1)
      fLevels.pop_back();

   if (fLevels.size() != 1)
      return false;

   fLevels.front().iter.reset(nullptr);

   return true;
}


/////////////////////////////////////////////////////////////////////
/// Navigate to specified path

bool RBrowsable::Navigate(const std::vector<std::string> &paths)
{
   // TODO: reuse existing items if any
   if (!ResetLevels())
      return false;

   bool find = true;

   for (auto &subdir : paths) {

      auto &level = fLevels.back();

      level.iter = level.item->GetChildsIter();
      if (!level.iter || !level.iter->Find(subdir)) {
         find = false;
         break;
      }

      auto subitem = level.iter->GetElement();
      if (!subitem) {
         find = false;
         break;
      }

      fLevels.emplace_back(subdir, subitem);
   }

   if (!find)
      ResetLevels();

   return find;
}


bool RBrowsable::DecomposePath(const std::string &path, std::vector<std::string> &arr)
{
   arr.clear();

   std::string slash = "/";

   if (path.empty() || (path == slash))
      return true;

   std::size_t previous = 0;
   if (path[0] == slash[0]) previous++;
   std::size_t current = path.find(slash, previous);
   while (current != std::string::npos) {
      if (current > previous)
         arr.emplace_back(path.substr(previous, current - previous));
      previous = current + 1;
      current = path.find(slash, previous);
   }

   if (previous < path.length())
      arr.emplace_back(path.substr(previous));
   return true;
}


bool RBrowsable::ProcessRequest(const RBrowserRequest &request, RBrowserReply &reply)
{
   std::vector<std::string> arr;

   if (gDebug > 0)
      printf("REQ: Do decompose path '%s'\n",request.path.c_str());

   if (!DecomposePath(request.path, arr))
      return false;

   if (gDebug > 0) {
      printf("REQ:Try to navigate %d\n", (int) arr.size());
      for (auto & subdir : arr) printf("   %s\n", subdir.c_str());
   }

   if (!Navigate(arr))
      return false;

   auto &curr = fLevels.back();

   // when request childs, always try to make elements
   if (curr.chlds.size() == 0) {
      auto iter = curr.item->GetChildsIter();
      if (!iter) return false;
      int id = 0;
      curr.all_chlds = true;

      while (iter->Next() && curr.all_chlds) {
         curr.chlds.emplace_back(iter->CreateBrowserItem());
         if (id++ > 10000)
            curr.all_chlds = false;
      }

      if (curr.all_chlds)
         iter->Sort(curr.chlds);

   }

   int first = request.first, last = curr.chlds.size();

   if ((request.number > 0) && (request.first + request.number < last))
      last = request.first + request.number;

   for (auto id = first; id < last; id ++)
      reply.nodes.emplace_back(curr.chlds[id].get());

   reply.first = request.first;
   reply.nchilds = curr.chlds.size(); // total number of childs

   return true;
}


std::string RBrowsable::ProcessRequest(const RBrowserRequest &request)
{
   RBrowserReply reply;

   reply.path = request.path;
   reply.first = 0;
   reply.nchilds = 0;

   ProcessRequest(request, reply);

   return TBufferJSON::ToJSON(&reply, TBufferJSON::kSkipTypeInfo + TBufferJSON::kNoSpaces).Data();
}


std::shared_ptr<RElement> RBrowsable::GetElement(const std::string &path)
{
   std::vector<std::string> arr;

   if (!DecomposePath(path, arr))
      return nullptr;

   if (!Navigate(arr))
      return nullptr;

   return fLevels.back().item;
}


