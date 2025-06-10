ROOTTEST_ADD_TEST(execKeyOrder
	               MACRO execKeyOrder.C
		            OUTREF execKeyOrder.ref)

ROOTTEST_ADD_TEST(execCreateAndMerge
                  MACRO execCreateAndMerge.C
                  OUTREF references/execCreateAndMerge.ref)

ROOTTEST_ADD_TEST(execMergeMulti
                  MACRO execMergeMulti.C
                  OUTREF references/execMergeMulti.ref
                  FIXTURES_SETUP root-io-filemerger-MergeMulti-fixture)

ROOTTEST_ADD_TEST(execFileMerger
                  MACRO execFileMerger.C
                  OUTREF references/execFileMerger.ref)

# FIXME: Should be CTEST fixtures
ROOTTEST_ADD_TEST(datagen-hadd-mfile12
                  COMMAND ${ROOT_hadd_CMD} -f mfile1-2.root mfile1.root mfile2.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mfile34
                  COMMAND ${ROOT_hadd_CMD} -f mfile3-4.root mfile3.root mfile4.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mzfile12
                  COMMAND ${ROOT_hadd_CMD} -f209 mzfile1-2.root mfile1.root mfile2.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mzfile12-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mzfile34
                  COMMAND ${ROOT_hadd_CMD} -f209 mzfile3-4.root mfile3.root mfile4.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mzfile34-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mzlibfile12
                  COMMAND ${ROOT_hadd_CMD} -f101 mzlibfile1-2.root mfile1.root mfile2.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mzlibfile12-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mzlibfile34
                  COMMAND ${ROOT_hadd_CMD} -f101 mzlibfile3-4.root mfile3.root mfile4.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mzlibfile34-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mlz4file12
                  COMMAND ${ROOT_hadd_CMD} -f404 mlz4file1-2.root mfile1.root mfile2.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mlz4file12-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mlz4file34
                  COMMAND ${ROOT_hadd_CMD} -f404 mlz4file3-4.root mfile3.root mfile4.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mlz4file34-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mzstdfile12
                  COMMAND ${ROOT_hadd_CMD} -f505 mzstdfile1-2.root mfile1.root mfile2.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mzstdfile12-fixture)

ROOTTEST_ADD_TEST(datagen-hadd-mzstdfile34
                  COMMAND ${ROOT_hadd_CMD} -f505 mzstdfile3-4.root mfile3.root mfile4.root
                  WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
                  FIXTURES_REQUIRED root-io-filemerger-MergeMulti-fixture
                  FIXTURES_SETUP root-io-filemerger-datagen-hadd-mzstdfile34-fixture)

if(ZLIB_CF)
  ROOTTEST_ADD_TEST(merged-zlib
                    PRECMD  ${ROOT_hadd_CMD} -f101 mzlibfile1-4.root mzlibfile1-2.root mzlibfile3-4.root
                    COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzlibfile1-4.root\",101,4804,20)"
                    FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzlibfile12-fixture root-io-filemerger-datagen-hadd-mzlibfile34-fixture)
else()
  ROOTTEST_ADD_TEST(merged-zlib
                    PRECMD  ${ROOT_hadd_CMD} -f101 mzlibfile1-4.root mzlibfile1-2.root mzlibfile3-4.root
                    COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzlibfile1-4.root\",101,5014,20)"
                    FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzlibfile12-fixture root-io-filemerger-datagen-hadd-mzlibfile34-fixture)
endif()

ROOTTEST_ADD_TEST(merged-lzma
                  PRECMD ${ROOT_hadd_CMD} -f207 mzfile1-4.root mzfile1-2.root mzfile3-4.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzfile1-4.root\",207,4455,20)"
                  FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzfile12-fixture root-io-filemerger-datagen-hadd-mzfile34-fixture)

if(${LZ4_VERSION} VERSION_LESS "1.7.5")
   ROOTTEST_ADD_TEST(merged-lz4
                  PRECMD ${ROOT_hadd_CMD} -f404 mlz4file1-4.root mlz4file1-2.root mlz4file3-4.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mlz4file1-4.root\",404,5422,5)"
                  FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mlz4file12-fixture root-io-filemerger-datagen-hadd-mlz4file34-fixture)
elseif(${LZ4_VERSION} VERSION_GREATER_EQUAL "1.7.5")
   ROOTTEST_ADD_TEST(merged-lz4
                  PRECMD ${ROOT_hadd_CMD} -f404 mlz4file1-4.root mlz4file1-2.root mlz4file3-4.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mlz4file1-4.root\",404,5395,5)"
                  FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mlz4file12-fixture root-io-filemerger-datagen-hadd-mlz4file34-fixture)
endif()

if(CMAKE_SIZEOF_VOID_P EQUAL 4)
   if(${ZSTD_VERSION} VERSION_LESS_EQUAL "1.3.3")
      ROOTTEST_ADD_TEST(merged-zstd
            PRECMD ${ROOT_hadd_CMD} -f505 mzstdfile1-4.root mzstdfile1-2.root mzstdfile3-4.root
            COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzstdfile1-4.root\",505,4533,20)"
            FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzstdfile12-fixture root-io-filemerger-datagen-hadd-mzstdfile34-fixture)
   else(${ZSTD_VERSION} VERSION_GREATER "1.3.3")
      ROOTTEST_ADD_TEST(merged-zstd
            PRECMD ${ROOT_hadd_CMD} -f505 mzstdfile1-4.root mzstdfile1-2.root mzstdfile3-4.root
            COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzstdfile1-4.root\",505,4456,20)"
            FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzstdfile12-fixture root-io-filemerger-datagen-hadd-mzstdfile34-fixture)
   endif()
else()
   if(${ZSTD_VERSION} VERSION_LESS_EQUAL "1.3.3")
      ROOTTEST_ADD_TEST(merged-zstd
                  PRECMD ${ROOT_hadd_CMD} -f505 mzstdfile1-4.root mzstdfile1-2.root mzstdfile3-4.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzstdfile1-4.root\",505,4529,20)"
                  FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzstdfile12-fixture root-io-filemerger-datagen-hadd-mzstdfile34-fixture)
   else(${ZSTD_VERSION} VERSION_GREATER "1.3.3")
      ROOTTEST_ADD_TEST(merged-zstd
                  PRECMD ${ROOT_hadd_CMD} -f505 mzstdfile1-4.root mzstdfile1-2.root mzstdfile3-4.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testMergedFile.C(\"mzstdfile1-4.root\",505,4454,20)"
                  FIXTURES_REQUIRED root-io-filemerger-datagen-hadd-mzstdfile12-fixture root-io-filemerger-datagen-hadd-mzstdfile34-fixture)
   endif()
endif()

#TBD: add file generation as test fixture
add_test(NAME roottest-root-io-filemerger-hsimple
         COMMAND ${ROOT_root_CMD} -q -l -b -e "#pragma STDC FP_CONTRACT OFF" ${ROOT_TUTORIALS_DIR}/hsimple.C -e "{ TFile f(\"hsimple.root\"); TTree *ntuple; f.GetObject(\"ntuple\",ntuple); return ntuple ? 0 : 1; }"
         WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR})

set_property(TEST roottest-root-io-filemerger-hsimple PROPERTY FIXTURES_SETUP roottest-root-io-filemerger-hsimple-fixture)


if(${compression_default} STREQUAL "zlib")
   if(ZLIB_CF)
      ROOTTEST_ADD_TEST(simple-default-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -f9 hsimple9.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple9.root\",25000,9,441500,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-default-compr-level9-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level1
                  PRECMD ${ROOT_hadd_CMD} -f101 hsimple101.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple101.root\",25000,101,443022,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level6
                  PRECMD ${ROOT_hadd_CMD} -f106 hsimple106.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple106.root\",25000,106,441608,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -f109 hsimple109.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple109.root\",25000,109,441508,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-default-compr-level9-datageneration
                  PRECMD  ${ROOT_hadd_CMD} -f9 hsimple9x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple9x2.root\",25000,9,441508,25)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple9x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple92.root
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-default-compr-level9-datageneration-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level9-datageneration
                  PRECMD  ${ROOT_hadd_CMD} -f109 hsimple109x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple109x2.root\",25000,109,441516,25)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple109x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple1092.root
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-zlib-compr-level9-datageneration-fixture)

      ROOTTEST_ADD_TEST(simplex2-default-compr-level9
                  PRECMD  ${ROOT_hadd_CMD} -f9 -a hsimple9x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple9x2.root\",50000,9,871048,30)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple9x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple92.root
                  FIXTURES_REQUIRED root-io-filemerger-simple-default-compr-level9-datageneration-fixture
                  FIXTURES_SETUP root-io-filemerger-simplex2-default-compr-level9-fixture)

      ROOTTEST_ADD_TEST(simplex2-zlib-compr-level9
                  PRECMD  ${ROOT_hadd_CMD} -f109 -a hsimple109x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple109x2.root\",50000,109,871053,30)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple109x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple1092.root
                  FIXTURES_REQUIRED root-io-filemerger-simple-zlib-compr-level9-datageneration-fixture)

      ROOTTEST_ADD_TEST(simplek-default-compr-deflevel
                  PRECMD ${ROOT_hadd_CMD} -fk hsimpleK.root hsimple209.root hsimple409.root hsimple.root hsimple9.root hsimple92.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK.root\",6*25000,209,2297616,30)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                    root-io-filemerger-simple-lz4-compr-level9-fixture
                                    root-io-filemerger-simple-lzma-compr-level-fixture
                                    root-io-filemerger-simplex2-default-compr-level9-fixture
                                    root-io-filemerger-simple-default-compr-level9-fixture
                  FIXTURES_SETUP root-io-filemerger-simplek-default-compr-deflevel-fixture)

      ROOTTEST_ADD_TEST(simplek-lzma-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -fk209 hsimpleK209.root hsimpleK.root hsimple209.root hsimple409.root hsimple.root hsimple9.root hsimple92.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK209.root\",12*25000,209,4583840,30)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                    root-io-filemerger-simple-lz4-compr-level9-fixture
                                    root-io-filemerger-simple-lzma-compr-level9-fixture
                                    root-io-filemerger-simplex2-default-compr-level9-fixture
                                    root-io-filemerger-simple-default-compr-level9-fixture
                                    root-io-filemerger-simplek-default-compr-deflevel-fixture
                  FIXTURES_SETUP root-io-filemerger-simplek-lzma-compr-level9-fixture)

      ROOTTEST_ADD_TEST(simplef-default-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -ff hsimpleF.root hsimple9.root hsimple209.root hsimple409.root hsimpleK404.root hsimple.root hsimple92.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleF.root\",30*25000,9,12889798,30)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                    root-io-filemerger-simple-lz4-compr-level9-fixture
                                    root-io-filemerger-simple-lzma-compr-level9-fixture
                                    root-io-filemerger-simplex2-default-compr-level9-fixture
                                    root-io-filemerger-simple-default-compr-level9-fixture
                                    root-io-filemerger-simplek-lz4-compr-level4-fixture)

      ROOTTEST_ADD_TEST(simplek-lz4-compr-level4
               PRECMD ${ROOT_hadd_CMD} -fk404 hsimpleK404.root hsimpleK209.root hsimpleK.root hsimple.root hsimple9.root hsimple209.root hsimple409.root hsimple92.root
               COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK404.root\",24*25000,404,12047492,30)"
               FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                 root-io-filemerger-simple-lz4-compr-level9-fixture
                                 root-io-filemerger-simple-lzma-compr-level9-fixture
                                 root-io-filemerger-simplex2-default-compr-level9-fixture
                                 root-io-filemerger-simple-default-compr-level9-fixture
                                 root-io-filemerger-simplek-lzma-compr-level9-fixture
               FIXTURES_SETUP root-io-filemerger-simplek-lz4-compr-level4-fixture)

      ROOTTEST_ADD_TEST(simple-lz4-compr-level4
                     PRECMD ${ROOT_hadd_CMD} -f404 hsimple404.root hsimple.root
                     COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple404.root\",25000,404,517262,15)"
                     FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-lz4-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -f409 hsimple409.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple409.root\",25000,409,517008,15)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-lz4-compr-level9-fixture)

      ROOTTEST_ADD_TEST(simple-lz4-compr-level1
                     PRECMD ${ROOT_hadd_CMD} -f401 hsimple401.root hsimple.root
                     COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple401.root\",25000,401,519976,5)"
                     FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)
   else()
      ROOTTEST_ADD_TEST(simple-default-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -f9 hsimple9.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple9.root\",25000,9,431015,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-default-compr-level9-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level1
                  PRECMD ${ROOT_hadd_CMD} -f101 hsimple101.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple101.root\",25000,101,415025,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level6
                  PRECMD ${ROOT_hadd_CMD} -f106 hsimple106.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple106.root\",25000,106,431303,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -f109 hsimple109.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple109.root\",25000,109,431024,25)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      ROOTTEST_ADD_TEST(simple-default-compr-level9-datageneration
                  PRECMD  ${ROOT_hadd_CMD} -f9 hsimple9x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple9x2.root\",25000,9,431023,25)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple9x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple92.root
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-default-compr-level9-datageneration-fixture)

      ROOTTEST_ADD_TEST(simple-zlib-compr-level9-datageneration
                  PRECMD  ${ROOT_hadd_CMD} -f109 hsimple109x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple109x2.root\",25000,109,431032,25)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple109x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple1092.root
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-zlib-compr-level9-datageneration-fixture)

      ROOTTEST_ADD_TEST(simplex2-default-compr-level9
                  PRECMD  ${ROOT_hadd_CMD} -f9 -a hsimple9x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple9x2.root\",50000,9,850127,30)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple9x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple92.root
                  FIXTURES_REQUIRED root-io-filemerger-simple-default-compr-level9-datageneration-fixture
                  FIXTURES_SETUP root-io-filemerger-simplex2-default-compr-level9-fixture)

      ROOTTEST_ADD_TEST(simplex2-zlib-compr-level9
                  PRECMD  ${ROOT_hadd_CMD} -f109 -a hsimple109x2.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple109x2.root\",50000,109,850136,30)"
                  POSTCMD ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/hsimple109x2.root ${CMAKE_CURRENT_BINARY_DIR}/hsimple1092.root
                  FIXTURES_REQUIRED root-io-filemerger-simple-zlib-compr-level9-datageneration-fixture)

      ROOTTEST_ADD_TEST(simplek-default-compr-deflevel
                  PRECMD ${ROOT_hadd_CMD} -fk hsimpleK.root hsimple209.root hsimple409.root hsimple.root hsimple9.root hsimple92.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK.root\",6*25000,209,2297616,30)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                    root-io-filemerger-simple-lz4-compr-level9-fixture
                                    root-io-filemerger-simple-lzma-compr-level9-fixture
                                    root-io-filemerger-simplex2-default-compr-level9-fixture
                                    root-io-filemerger-simple-default-compr-level9-fixture
                  FIXTURES_SETUP root-io-filemerger-simplek-default-compr-deflevel-fixture)

      ROOTTEST_ADD_TEST(simplek-lzma-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -fk209 hsimpleK209.root hsimpleK.root hsimple209.root hsimple409.root hsimple.root hsimple9.root hsimple92.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK209.root\",12*25000,209,4583840,30)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                    root-io-filemerger-simple-lz4-compr-level9-fixture
                                    root-io-filemerger-simple-lzma-compr-level9-fixture
                                    root-io-filemerger-simplex2-default-compr-level9-fixture
                                    root-io-filemerger-simple-default-compr-level9-fixture
                                    root-io-filemerger-simplek-default-compr-deflevel-fixture
                  FIXTURES_SETUP root-io-filemerger-simplek-lzma-compr-level9-fixture)
      if(${LZ4_VERSION} VERSION_LESS "1.7.5")
         ROOTTEST_ADD_TEST(simple-lz4-compr-level9
                        PRECMD ${ROOT_hadd_CMD} -f409 hsimple409.root hsimple.root
                        COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple409.root\",25000,409,516893,5)"
                        FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                        FIXTURES_SETUP root-io-filemerger-simple-lz4-compr-level9-fixture)

         ROOTTEST_ADD_TEST(simplek-lz4-compr-level4
                     PRECMD ${ROOT_hadd_CMD} -fk404 hsimpleK404.root hsimpleK209.root hsimpleK.root hsimple.root hsimple9.root hsimple209.root hsimple409.root hsimple92.root
                     COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK404.root\",24*25000,404,12047489,30)"
                     FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                       root-io-filemerger-simple-lz4-compr-level9-fixture
                                       root-io-filemerger-simple-lzma-compr-level9-fixture
                                       root-io-filemerger-simplex2-default-compr-level9-fixture
                                       root-io-filemerger-simple-default-compr-level9-fixture
                                       root-io-filemerger-simplek-lzma-compr-level9-fixture
                     FIXTURES_SETUP root-io-filemerger-simplek-lz4-compr-level4-fixture)

         ROOTTEST_ADD_TEST(simple-lz4-compr-level4
                        PRECMD ${ROOT_hadd_CMD} -f404 hsimple404.root hsimple.root
                        COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple404.root\",25000,404,517275,15)"
                        FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

         ROOTTEST_ADD_TEST(simple-lz4-compr-level1
                        PRECMD ${ROOT_hadd_CMD} -f401 hsimple401.root hsimple.root
                        COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple401.root\",25000,401,418016,5)"
                        FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)

      elseif(${LZ4_VERSION} VERSION_GREATER_EQUAL "1.7.5")
         ROOTTEST_ADD_TEST(simplek-lz4-compr-level4
                     PRECMD ${ROOT_hadd_CMD} -fk404 hsimpleK404.root hsimpleK209.root hsimpleK.root hsimple.root hsimple9.root hsimple209.root hsimple409.root hsimple92.root
                     COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleK404.root\",24*25000,404,12047492,30)"
                     FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                       root-io-filemerger-simple-lz4-compr-level9-fixture
                                       root-io-filemerger-simple-lzma-compr-level9-fixture
                                       root-io-filemerger-simplex2-default-compr-level9-fixture
                                       root-io-filemerger-simple-default-compr-level9-fixture
                                       root-io-filemerger-simplek-lzma-compr-level9-fixture
                     FIXTURES_SETUP root-io-filemerger-simplek-lz4-compr-level4-fixture)

         ROOTTEST_ADD_TEST(simple-lz4-compr-level4
                        PRECMD ${ROOT_hadd_CMD} -f404 hsimple404.root hsimple.root
                        COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple404.root\",25000,404,517262,15)"
                        FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture)
         if(CMAKE_SYSTEM_PROCESSOR MATCHES aarch64)
            ROOTTEST_ADD_TEST(simple-lz4-compr-level9
                              PRECMD ${ROOT_hadd_CMD} -f409 hsimple409.root hsimple.root
                              COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple409.root\",25000,409,516975,30)"
                              FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                              FIXTURES_SETUP root-io-filemerger-simple-lz4-compr-level9-fixture)
         else()
            ROOTTEST_ADD_TEST(simple-lz4-compr-level9
                          PRECMD ${ROOT_hadd_CMD} -f409 hsimple409.root hsimple.root
                          COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple409.root\",25000,409,517008,15)"
                          FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                          FIXTURES_SETUP root-io-filemerger-simple-lz4-compr-level9-fixture)
         endif()
         ROOTTEST_ADD_TEST(simple-lz4-compr-level1
                        PRECMD ${ROOT_hadd_CMD} -f401 hsimple401.root hsimple.root
                        COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple401.root\",25000,401,519976,10)"
                        FIXTURES_REQUIRED root-io-filemerger-roottest-root-io-filemerger-hsimple-fixture)
      endif()

      ROOTTEST_ADD_TEST(simplef-default-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -ff hsimpleF.root hsimple9.root hsimple209.root hsimple409.root hsimpleK404.root hsimple.root hsimple92.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimpleF.root\",30*25000,9,12581462,30)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                                    root-io-filemerger-simple-lz4-compr-level9-fixture
                                    root-io-filemerger-simple-lzma-compr-level9-fixture
                                    root-io-filemerger-simplex2-default-compr-level9-fixture
                                    root-io-filemerger-simple-default-compr-level9-fixture
                                    root-io-filemerger-simplek-lz4-compr-level4-fixture)
   endif()
endif()

ROOTTEST_ADD_TEST(simple-lzma-compr-level9
                  PRECMD ${ROOT_hadd_CMD} -f209 hsimple209.root hsimple.root
                  COMMAND ${ROOT_root_CMD} -q -l -b "${CMAKE_CURRENT_SOURCE_DIR}/testSimpleFile.C(\"hsimple209.root\",25000,209,392709,17)"
                  FIXTURES_REQUIRED roottest-root-io-filemerger-hsimple-fixture
                  FIXTURES_SETUP root-io-filemerger-simple-lzma-compr-level9-fixture)
