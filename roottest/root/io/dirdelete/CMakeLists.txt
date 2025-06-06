# test demonstrate problem with directory delete
# dirdelete.fail.ref shows current - not perfect - implementation
# in ideal case dirdelete.ref file must be used as reference

ROOTTEST_ADD_TEST(rootfile
                  MACRO rundirdelete.C
                  OUTREF dirdelete.fail.ref)

ROOTTEST_ADD_TEST(xmlfile
                  MACRO rundirdelete.C
                  MACROARG 1
                  OUTREF dirdelete.fail.ref)

