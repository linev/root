# ROOTTEST_ADD_OLDTEST()

if (CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(_ext ref)
else()
  set(_ext ref32)
endif()

ROOTTEST_ADD_TEST(execROOT8804
                  MACRO execROOT8804.C
                  COPY_TO_BUILDDIR lariat-si.root
                  OUTREF execROOT8804.${_ext})

ROOTTEST_COMPILE_MACRO(classes.h
                       FIXTURES_SETUP classes-h-fixtures)

ROOTTEST_COMPILE_MACRO(marker.h
                       FIXTURES_SETUP marker-h-fixtures)

if(ClingWorkAroundMissingSmartInclude)
  set(_opts_classes -e "(void)gROOT->ProcessLine(\".L classes.h+\")")
  set(_opts_marker -e "(void)gROOT->ProcessLine(\".L marker.h+\")")
endif()

ROOTTEST_ADD_TEST(write
                  MACRO write.C
                  ROOTEXE_OPTS ${_opts_classes} ${_opts_marker}
                  FIXTURES_REQUIRED classes-h-fixtures marker-h-fixtures
                  FIXTURES_SETUP write-fixtures)

ROOTTEST_ADD_TEST(read
                  MACRO read.C
                  OUTREF read.ref
                  ROOTEXE_OPTS ${_opts_marker}
                  FIXTURES_REQUIRED marker-h-fixtures write-fixtures
                  FIXTURES_SETUP read-fixtures)

ROOTTEST_ADD_TEST(rewrite
                  MACRO rewrite.C
                  OUTREF rewrite.ref
                  ROOTEXE_OPTS ${_opts_marker}
                  FIXTURES_REQUIRED marker-h-fixtures read-fixtures)

ROOTTEST_ADD_TEST(writeAbstract
                  MACRO writeAbstract.cxx+
                  FIXTURES_SETUP writeAbstract-fixtures)

ROOTTEST_ADD_TEST(readAbstract
                  MACRO readAbstract.cxx+
                  OUTREF readAbstract.ref
                  FIXTURES_REQUIRED writeAbstract-fixtures)
