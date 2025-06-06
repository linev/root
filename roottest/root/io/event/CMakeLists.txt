ROOTTEST_GENERATE_DICTIONARY(libTestIoEvent
                             Event.h
                             LINKDEF EventLinkDef.h
                             SOURCES Event.cxx
                             NO_ROOTMAP
                             NO_CXXMODULE
                             FIXTURES_SETUP libTestIoEvent-fixtures)

ROOTTEST_GENERATE_EXECUTABLE(TestIoEvent
                             MainEvent.cxx
                             LIBRARIES Core RIO libTestIoEventlibgen
                             FIXTURES_REQUIRED libTestIoEvent-fixtures
                             FIXTURES_SETUP TestIoEvent-fixtures)

ROOTTEST_ADD_TEST(write
                  COMMAND ./TestIoEvent 10 1 1 1
                  FIXTURES_REQUIRED TestIoEvent-fixtures
                  FIXTURES_SETUP TestIoEventwrite-fixtures)

ROOTTEST_ADD_TEST(read
                  COMMAND ./TestIoEvent 10 1 1 20
                  FIXTURES_REQUIRED TestIoEventwrite-fixtures)
