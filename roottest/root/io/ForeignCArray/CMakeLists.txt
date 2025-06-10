ROOTTEST_GENERATE_DICTIONARY(libForeignCArray
                             MyClasses.h
                             LINKDEF LinkDef.h
                             NO_ROOTMAP
                             NO_CXXMODULE
                             FIXTURES_SETUP root-io-ForeignCArray-libForeignCArray-fixture)

ROOTTEST_GENERATE_EXECUTABLE(TestForeignCArray
                             mytest.cxx
                             LIBRARIES Core RIO libForeignCArraylibgen
                             FIXTURES_REQUIRED root-io-ForeignCArray-libForeignCArray-fixture
                             FIXTURES_SETUP root-io-ForeignCArray-TestForeignCArray-fixture)

ROOTTEST_ADD_TEST(mytest
                  COMMAND ./TestForeignCArray
                  FIXTURES_REQUIRED root-io-ForeignCArray-TestForeignCArray-fixture
                  OUTREF mytest.ref)
