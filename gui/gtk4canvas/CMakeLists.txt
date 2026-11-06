# Copyright (C) 1995-2026, Rene Brun and Fons Rademakers.
# All rights reserved.
#
# For the licensing terms see $ROOTSYS/LICENSE.
# For the list of contributors see $ROOTSYS/README/CREDITS.

############################################################################
# CMakeLists.txt file for building ROOT gui/gtk4canvas package
############################################################################

if(MSVC)
  # for debugging purposes set
  set(PKG_CONFIG_EXECUTABLE "C:/git/vcpkg/installed/x64-windows/tools/pkgconf/pkgconf.exe" CACHE FILEPATH "pkg-config executable")

  # Tell pkg-config exactly where the gtkmm .pc file registry lives inside vcpkg
  set(ENV{PKG_CONFIG_PATH} "C:/git/vcpkg/installed/x64-windows/lib/pkgconfig")

  # when call cmake
  #  cmake -DCMAKE_TOOLCHAIN_FILE="C:/git/vcpkg/scripts/buildsystems/vcpkg.cmake" -DVCPKG_TARGET_TRIPLET=x64-windows
endif()

find_package(PkgConfig REQUIRED)

pkg_check_modules(GTKMM REQUIRED IMPORTED_TARGET gtkmm-4.0)

if(NOT GTKMM_FOUND)
  if(fail-on-missing)
    message(FATAL_ERROR "Could NOT find gtkmm-4.0 components")
  else()
    message(WARNING "GTKMM not found, disabling option 'gtk4canv'")
    set(gtk4canv OFF CACHE BOOL "Disabled because GTKMM not found" FORCE)
    return()
  endif()
endif()


ROOT_STANDARD_LIBRARY_PACKAGE(ROOTGtk4Canvas
  HEADERS
    TGtk4Canvas.h
    TGtk4GuiFactory.h
    TGtk4PadPainter.h
    TGtk4GedEditor.h
  SOURCES
    Gtk4DrawArea.cxx
    Gtk4CanvasWindow.cxx
    Gtk4MethodDialog.cxx
    TGtk4ContextMenu.cxx
    TGtk4Canvas.cxx
    TGtk4GuiFactory.cxx
    TGtk4PadPainter.cxx
    TGtk4GedEditor.cxx
  LIBRARIES
    PkgConfig::GTKMM
  DEPENDENCIES
    Core
    Gpad
)
