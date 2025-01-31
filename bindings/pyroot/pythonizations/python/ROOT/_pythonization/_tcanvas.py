from . import pythonization

def wait_press_windows():
   import ROOT
   import msvcrt
   import time

   done = False
   while not done:
      k = ''
      ROOT.gSystem.ProcessEvents()
      if msvcrt.kbhit():
         k = msvcrt.getch()
         done = k[0] == 32
      else:
         time.sleep(0.01)


def wait_press_posix():
   import ROOT
   import sys
   import select
   import tty
   import termios
   import time

   old_settings = termios.tcgetattr(sys.stdin)

   tty.setcbreak(sys.stdin.fileno())

   try:

      while True:
         ROOT.gSystem.ProcessEvents()
         c = ''
         if select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], []):
            c = sys.stdin.read(1)
         if (c == '\x20'):
            break
         time.sleep(0.01)

   finally:
      termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)


def _TCanvas_Update(self, *args, **kwargs):
   """
   Invoke normal Draw, but then run event loop until key is pressed
   """

   import ROOT
   import os
   import sys

   self._Update(*args, **kwargs)

   # no special handling in batch mode
   if ROOT.gROOT.IsBatch():
      return

   # no special handling in case of notebooks
   if 'IPython' in sys.modules or 'ipykernel' in sys.modules:
      return

   print("Press <space> key to continue")

   if os.name == 'nt':
      wait_press_windows()
   else:
      wait_press_posix()


@pythonization('TCanvas')
def pythonize_tcanvas(klass):
    # Parameters:
    # klass: class to be pythonized

    klass._Update = klass.Update
    klass.Update = _TCanvas_Update

