#include "TString.h"
#include "TInterpreter.h"
#include "TSystem.h"

void libs(TString classname)
{
   const char *libname;

   // Find in which library classname sits
   classname.ReplaceAll("_1",":");
   classname.ReplaceAll("_01"," ");
   int i = classname.Index("_3");
   if (i>0) classname.Remove(i,classname.Length()-i);

   libname = gInterpreter->GetClassSharedLibs(classname.Data(),false);
   if (!libname)
      return;

   printf("mainlib=%s", libname);
}
