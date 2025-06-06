// @(#)root/test:$Id$
// Author: Rene Brun   19/08/96

////////////////////////////////////////////////////////////////////////
//
//                       Event and Track classes
//                       =======================
//
//  The Event class is a naive/simple example of an event structure.
//     public:
//        char           fType[20];
//        char          *fEventName;         //run+event number in character format
//        Int_t          fNtrack;
//        Int_t          fNseg;
//        Int_t          fNvertex;
//        UInt_t         fFlag;
//        Double32_t     fTemperature;
//        Int_t          fMeasures[10];
//        Double32_t     fMatrix[4][4];
//        Double32_t    *fClosestDistance; //[fNvertex] indexed array!
//        EventHeader    fEvtHdr;
//        TClonesArray  *fTracks;
//        TRef           fHistoWeb;          //EXEC:GetHistoWeb reference to an histogram in a TWebFile
//        TH1F          *fH;
//
//   The EventHeader class has 3 data members (integers):
//     public:
//        Int_t          fEvtNum;
//        Int_t          fRun;
//        Int_t          fDate;
//
//
//   The Event data member fTracks is a pointer to a TClonesArray.
//   It is an array of a variable number of tracks per event.
//   Each element of the array is an object of class Track with the members:
//     private:
//        Float_t      fPx;           //X component of the momentum
//        Float_t      fPy;           //Y component of the momentum
//        Float_t      fPz;           //Z component of the momentum
//        Float_t      fRandom;       //A random track quantity
//        Float_t      fMass2;        //The mass square of this particle
//        Float_t      fBx;           //X intercept at the vertex
//        Float_t      fBy;           //Y intercept at the vertex
//        Float_t      fMeanCharge;   //Mean charge deposition of all hits of this track
//        Float_t      fXfirst;       //X coordinate of the first point
//        Float_t      fXlast;        //X coordinate of the last point
//        Float_t      fYfirst;       //Y coordinate of the first point
//        Float_t      fYlast;        //Y coordinate of the last point
//        Float_t      fZfirst;       //Z coordinate of the first point
//        Float_t      fZlast;        //Z coordinate of the last point
//        Double32_t   fCharge;       //Charge of this track
//        Double32_t   fVertex[3];    //Track vertex position
//        Int_t        fNpoint;       //Number of points for this track
//        Short_t      fValid;        //Validity criterion
//
//   An example of a batch program to use the Event/Track classes is given
//   in this directory: MainEvent.
//   Look also in the same directory at the following macros:
//     - eventa.C  an example how to read the tree
//     - eventb.C  how to read events conditionally
//
//   During the processing of the event (optionally) also a large number
//   of histograms can be filled. The creation and handling of the
//   histograms is taken care of by the HistogramManager class.
//
////////////////////////////////////////////////////////////////////////

#include "Event.h"

#include "TClonesArray.h"
#include "TDirectory.h"
#include "TH1.h"
#include "TProcessID.h"
#include "TRandom.h"
#include "TRefArray.h"


ClassImp(EventHeader)
ClassImp(Event)
ClassImp(Track)
ClassImp(HistogramManager)

//______________________________________________________________________________
Event::Event()
: fEventName(0)
, fNtrack(0)
, fNseg(0)
, fNvertex(0)
, fFlag(0)
, fClosestDistance(0)
, fTemperature(0.0)
, fEvtHdr()
, fTracks(0)
, fH(0)
{
   // -- Create an Event object.

   fTracks = new TClonesArray("Track", 1000);
   for (Int_t i0 = 0; i0 < 4; i0++) {
      for (Int_t i1 = 0; i1 < 4; i1++) {
         fMatrix[i0][i1] = 0.0;
      }
   }
   for (Int_t i0 = 0; i0 < 20; i0++) {
      fType[i0] = 0;
   }
   for (Int_t i0 = 0; i0 < 10; i0++) {
      fMeasures[i0] = 0;
   }
}

//______________________________________________________________________________
Event::~Event()
{
   delete fH;
   fH = 0;
   if (fTracks) {
      fTracks->Clear("C");
   }
   delete fTracks;
   fTracks = 0;
   delete[] fClosestDistance;
   fClosestDistance = 0;
   delete[] fEventName;
   fEventName = 0;
}


//______________________________________________________________________________
void Event::Clear(Option_t* /*option*/)
{
   // -- FIXME: Describe this function.

   // will also call Track::Clear
   if (fTracks) {
      fTracks->Clear("C");
   }
}

//______________________________________________________________________________
void Event::Build(Int_t ev, Int_t arg5, Float_t)
{
   char etype[20];
   Float_t sigmat, sigmas;
   gRandom->Rannor(sigmat,sigmas);
   Int_t ntrack   = Int_t(arg5 +arg5*sigmat/120.);
   Float_t random = gRandom->Rndm(1);

   //Save current Object count
   Int_t ObjectNumber = TProcessID::GetObjectCount();
   Clear();

   Int_t nch = 15;
   if (ev >= 100)   nch += 3;
   if (ev >= 10000) nch += 3;
   if (fEventName) delete [] fEventName;
   fEventName = new char[nch];
   sprintf(fEventName,"Event%d_Run%d",ev,200);
   sprintf(etype,"type%d",ev%5);
   SetType(etype);
   SetHeader(ev, 200, 960312, random);
   SetNseg(Int_t(10*ntrack+20*sigmas));
   SetNvertex(Int_t(1+20*gRandom->Rndm()));
   SetFlag(UInt_t(random+0.5));
   SetTemperature(random+20.);

   for(UChar_t m = 0; m < 10; m++) {
      SetMeasure(m, Int_t(gRandom->Gaus(m,m+1)));
   }
   for(UChar_t i0 = 0; i0 < 4; i0++) {
     for(UChar_t i1 = 0; i1 < 4; i1++) {
        SetMatrix(i0,i1,gRandom->Gaus(i0*i1,1));
     }
   }


   //Restore Object count
   //To save space in the table keeping track of all referenced objects
   //we assume that our events do not address each other. We reset the
   //object count to what it was at the beginning of the event.
   TProcessID::SetObjectCount(ObjectNumber);
}


//______________________________________________________________________________
void Event::Reset(Option_t* /*option*/)
{
   // -- Delete tracks and histograms.
   delete fH;
   fH = 0;
   if (fTracks) {
      fTracks->Clear();
   }
   delete fTracks;
   fTracks = 0;
}

//______________________________________________________________________________
void Event::SetHeader(Int_t i, Int_t run, Int_t date, Float_t random)
{
   fNtrack = 0;
   fEvtHdr.Set(i, run, date);
   fH = new TH1F("hstat", "Event Histogram", 100, 0, 1);
   fH->SetDirectory(0);
   fH->Fill(random);
}

//______________________________________________________________________________
void Event::SetMeasure(UChar_t which, Int_t what)
{
   if (which < 10) {
      fMeasures[which] = what;
   }
}

//______________________________________________________________________________
void Event::SetRandomVertex()
{
   // This delete is to test the relocation of variable length array
   if (fClosestDistance) delete [] fClosestDistance;
   if (!fNvertex) {
      fClosestDistance = 0;
      return;
   }
   fClosestDistance = new Float_t[fNvertex];
   for (Int_t k = 0; k < fNvertex; k++ ) {
      fClosestDistance[k] = gRandom->Gaus(1,1);
   }
}

//______________________________________________________________________________
Track::Track(const Track& orig)
: TObject(orig)
{
   // Copy a track object

   fPx = orig.fPx;
   fPy = orig.fPy;
   fPz = orig.fPx;
   fRandom = orig.fRandom;
   fMass2 = orig.fMass2;
   fBx = orig.fBx;
   fBy = orig.fBy;
   fMeanCharge = orig.fMeanCharge;
   fXfirst = orig.fXfirst;
   fXlast  = orig.fXlast;
   fYfirst = orig.fYfirst;
   fYlast  = orig.fYlast;
   fZfirst = orig.fZfirst;
   fZlast  = orig.fZlast;
   fCharge = orig.fCharge;

   fVertex[0] = orig.fVertex[0];
   fVertex[1] = orig.fVertex[1];
   fVertex[2] = orig.fVertex[2];
   fNpoint = orig.fNpoint;
   fValid  = orig.fValid;
}

//______________________________________________________________________________
Track::Track(Float_t random)
: TObject()
{
   // Create a track object.
   // Note that in this example, data members do not have any physical meaning.

   Float_t a,b,px,py;
   gRandom->Rannor(px,py);
   fPx = px;
   fPy = py;
   fPz = TMath::Sqrt(px*px+py*py);
   fRandom = 1000*random;
   if (fRandom < 10) fMass2 = 0.106;
   else if (fRandom < 100) fMass2 = 0.8;
   else if (fRandom < 500) fMass2 = 4.5;
   else if (fRandom < 900) fMass2 = 8.9;
   else  fMass2 = 9.8;
   gRandom->Rannor(a,b);
   fBx = 0.1*a;
   fBy = 0.1*b;
   fMeanCharge = 0.01*gRandom->Rndm(1);
   gRandom->Rannor(a,b);
   fXfirst = a*10;
   fXlast  = b*10;
   gRandom->Rannor(a,b);
   fYfirst = a*12;
   fYlast  = b*16;
   gRandom->Rannor(a,b);
   fZfirst = 50 + 5*a;
   fZlast  = 200 + 10*b;
   fCharge = Double32_t(Int_t(3*gRandom->Rndm(1)) - 1);

   fVertex[0] = gRandom->Gaus(0,0.1);
   fVertex[1] = gRandom->Gaus(0,0.2);
   fVertex[2] = gRandom->Gaus(0,10);
   fNpoint = Int_t(60+10*gRandom->Rndm(1));
   fValid  = Int_t(0.6+gRandom->Rndm(1));
}

//______________________________________________________________________________
void Track::Clear(Option_t* /*option*/)
{
}

//______________________________________________________________________________
HistogramManager::HistogramManager(TDirectory* dir)
{
   // Create histogram manager object. Histograms will be created
   // in the "dir" directory.

   // Save current directory and cd to "dir".
   TDirectory *saved = gDirectory;
   dir->cd();

   fNtrack      = new TH1F("hNtrack",    "Ntrack",100,575,625);
   fNseg        = new TH1F("hNseg",      "Nseg",100,5800,6200);
   fTemperature = new TH1F("hTemperature","Temperature",100,19.5,20.5);
   fPx          = new TH1F("hPx",        "Px",100,-4,4);
   fPy          = new TH1F("hPy",        "Py",100,-4,4);
   fPz          = new TH1F("hPz",        "Pz",100,0,5);
   fRandom      = new TH1F("hRandom",    "Random",100,0,1000);
   fMass2       = new TH1F("hMass2",     "Mass2",100,0,12);
   fBx          = new TH1F("hBx",        "Bx",100,-0.5,0.5);
   fBy          = new TH1F("hBy",        "By",100,-0.5,0.5);
   fMeanCharge  = new TH1F("hMeanCharge","MeanCharge",100,0,0.01);
   fXfirst      = new TH1F("hXfirst",    "Xfirst",100,-40,40);
   fXlast       = new TH1F("hXlast",     "Xlast",100,-40,40);
   fYfirst      = new TH1F("hYfirst",    "Yfirst",100,-40,40);
   fYlast       = new TH1F("hYlast",     "Ylast",100,-40,40);
   fZfirst      = new TH1F("hZfirst",    "Zfirst",100,0,80);
   fZlast       = new TH1F("hZlast",     "Zlast",100,0,250);
   fCharge      = new TH1F("hCharge",    "Charge",100,-1.5,1.5);
   fNpoint      = new TH1F("hNpoint",    "Npoint",100,50,80);
   fValid       = new TH1F("hValid",     "Valid",100,0,1.2);

   // cd back to original directory
   saved->cd();
}

//______________________________________________________________________________
HistogramManager::~HistogramManager()
{
   // Clean up all histograms.

   // Nothing to do. Histograms will be deleted when the directory
   // in which tey are stored is closed.
}

//______________________________________________________________________________
void HistogramManager::Hfill(Event* event)
{
   // Fill histograms.

   fNtrack->Fill(event->GetNtrack());
   fNseg->Fill(event->GetNseg());
   fTemperature->Fill(event->GetTemperature());

   for (Int_t itrack = 0; itrack < event->GetNtrack(); itrack++) {
      Track *track = (Track*)event->GetTracks()->UncheckedAt(itrack);
      fPx->Fill(track->GetPx());
      fPy->Fill(track->GetPy());
      fPz->Fill(track->GetPz());
      fRandom->Fill(track->GetRandom());
      fMass2->Fill(track->GetMass2());
      fBx->Fill(track->GetBx());
      fBy->Fill(track->GetBy());
      fMeanCharge->Fill(track->GetMeanCharge());
      fXfirst->Fill(track->GetXfirst());
      fXlast->Fill(track->GetXlast());
      fYfirst->Fill(track->GetYfirst());
      fYlast->Fill(track->GetYlast());
      fZfirst->Fill(track->GetZfirst());
      fZlast->Fill(track->GetZlast());
      fCharge->Fill(track->GetCharge());
      fNpoint->Fill(track->GetNpoint());
      fValid->Fill(track->GetValid());
   }
}

