ROOTTEST_GENERATE_DICTIONARY(libTestIoEvent01
                             Event.h
                             LINKDEF EventLinkDef.h
                             SOURCES Event.cxx
                             NO_ROOTMAP
                             NO_CXXMODULE
                             FIXTURES_SETUP libTestIoEvent01-fixtures)

target_link_libraries(libTestIoEvent01libgen Physics)

ROOTTEST_GENERATE_EXECUTABLE(TestIoEvent01
                             MainEvent.cxx
                             LIBRARIES Core RIO libTestIoEvent01libgen
                             FIXTURES_REQUIRED libTestIoEvent01-fixtures
                             FIXTURES_SETUP TestIoEvent01-fixtures)

ROOTTEST_ADD_TEST(write
                  COMMAND ./TestIoEvent01 10000 1 1 1
                  FIXTURES_REQUIRED TestIoEvent01-fixtures
                  FIXTURES_SETUP TestIoEvent01write-fixtures
                  WILLFAIL)

ROOTTEST_ADD_TEST(read
                  COMMAND ./TestIoEvent01 10000 1 1 20
                  FIXTURES_REQUIRED TestIoEvent01write-fixtures
                  WILLFAIL)
