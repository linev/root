from . import pythonization

def _TCanvas_Draw(self, *args, **kwargs):
   """
   Invoke normal Draw, but then run event loop until key is pressed
   """

   import ROOT
   import sys
   import select
   import tty
   import termios
   import time

   self._Draw(*args, **kwargs)

   print("Press <space> key to continue")

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
         time.sleep(0.001)

   finally:
      termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)



@pythonization('TCanvas')
def pythonize_tcanvas(klass):
    # Parameters:
    # klass: class to be pythonized


    # Support hist.Fill(numpy_array) and hist.Fill(numpy_array, numpy_array)
    klass._Draw = klass.Draw
    klass.Draw = _TCanvas_Draw

