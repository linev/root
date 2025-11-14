#include <fstream>
#include <iostream>
#include <string>

#include "DataVector.h"

void runscript(const std::string &fname, bool with_rootmap = false)
{
   if (with_rootmap) {
      int old = gInterpreter->SetClassAutoloading(kFALSE);
      gInterpreter->LoadLibraryMap("libbtag.rootmap");
      gInterpreter->LoadLibraryMap("libjet.rootmap");
      gInterpreter->LoadLibraryMap("libsjet.rootmap");
      gInterpreter->SetClassAutoloading(old);
   }

   std::ifstream f(fname);

   //std::cout << "Processing " << fname << "\n";

   std::string str;
   while (std::getline(f, str)) {

      //std::cout << "Processing line: " << str << "\n";

      gROOT->ProcessLine(str.c_str());
   }
}