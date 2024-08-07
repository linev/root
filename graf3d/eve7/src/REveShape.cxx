// @(#)root/eve7:$Id$
// Author: Matevz Tadel, 2010

/*************************************************************************
 * Copyright (C) 1995-2019, Rene Brun and Fons Rademakers.               *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

#include <ROOT/REveShape.hxx>

#include <nlohmann/json.hpp>

using namespace ROOT::Experimental;

/** \class REveShape
\ingroup REve
Abstract base-class for 2D/3D shapes.

It provides:
  - fill color / transparency, accessible via Get/SetMainColor/Transparency;
  - frame line color / width;
  - flag if frame should be drawn;
  - flag specifying whether frame or whole shape should be emphasised for
    highlight.
*/

////////////////////////////////////////////////////////////////////////////////
/// Constructor.

REveShape::REveShape(const std::string &n, const std::string &t) :
   REveElement(n, t)
{
   fCanEditMainColor        = kTRUE;
   fCanEditMainTransparency = kTRUE;
   SetMainColorPtr(&fFillColor);
}

////////////////////////////////////////////////////////////////////////////////
/// Destructor.

REveShape::~REveShape()
{
}

////////////////////////////////////////////////////////////////////////////////
/// Fill core part of JSON representation.

Int_t REveShape::WriteCoreJson(nlohmann::json &j, Int_t rnr_offset)
{
   Int_t ret = REveElement::WriteCoreJson(j, rnr_offset);

   j["fFillColor"] = fFillColor;
   j["fLineColor"] = fLineColor;
   j["fFillAlpha"] = fFillAlpha;
   j["fLineAlpha"] = fLineAlpha;
   j["fLineWidth"] = fLineWidth;
   j["fDrawFrame"] = fDrawFrame;

   return ret;
}

////////////////////////////////////////////////////////////////////////////////
/// Set main color.
/// Override so that line-color can also be changed if it is equal
/// to fill color (which is treated as main color).

void REveShape::SetMainColor(Color_t color)
{
   if (fFillColor == fLineColor) {
      fLineColor = color;
      StampObjProps();
   }
   REveElement::SetMainColor(color);
}

////////////////////////////////////////////////////////////////////////////////
/// Copy visualization parameters from element el.

void REveShape::CopyVizParams(const REveElement* el)
{
   const REveShape* m = dynamic_cast<const REveShape*>(el);
   if (m)
   {
      fFillColor = m->fFillColor;
      fLineColor = m->fLineColor;
      fLineWidth = m->fLineWidth;
      fDrawFrame      = m->fDrawFrame;
      fHighlightFrame = m->fHighlightFrame;
      fMiniFrame      = m->fMiniFrame;
   }

   REveElement::CopyVizParams(el);
}

////////////////////////////////////////////////////////////////////////////////
/// Write visualization parameters.

void REveShape::WriteVizParams(std::ostream& out, const TString& var)
{
   REveElement::WriteVizParams(out, var);

   TString t = "   " + var + "->";
   out << t << "SetFillColor(" << fFillColor << ");\n";
   out << t << "SetLineColor(" << fLineColor << ");\n";
   out << t << "SetLineWidth(" << fLineWidth << ");\n";
   out << t << "SetDrawFrame("      << ToString(fDrawFrame) << ");\n";
   out << t << "SetHighlightFrame(" << ToString(fHighlightFrame) << ");\n";
}

////////////////////////////////////////////////////////////////////////////////
/// Determines the convex-hull of points in pin.
///
/// Adds the hull points to pout and returns the number of added points.
/// If size of pout is less then 3 then either the number of input points
/// was too low or they were degenerate so that the hull is actually a line
/// segment or even a point.

Int_t REveShape::FindConvexHull(const vVector2_t& pin, vVector2_t& pout, REveElement* caller)
{
   Int_t N = pin.size();

   // Find the minimum (bottom-left) point.
   Int_t min_point = 0;
   for (Int_t i = 1; i < N; ++i)
   {
      if (pin[i].fY < pin[min_point].fY || (pin[i].fY == pin[min_point].fY && pin[i].fX < pin[min_point].fX))
         min_point = i;
   }

   // Calculate angles and sort.
   std::vector<Float_t> angles(N);
   for (Int_t i = 0; i < N; ++i)
   {
      angles[i] = (pin[i] - pin[min_point]).Phi();
   }
   std::vector<Int_t> idcs(N);
   TMath::Sort(N, &angles[0], &idcs[0], kFALSE);

   // Weed out points with the same angle -- keep the furthest only.
   // The first point must stay.
   if (N > 2)
   {
      std::vector<Int_t> new_idcs;
      new_idcs.push_back(idcs[0]);
      auto a = idcs.begin(); ++a;
      auto b = a; ++b;
      while (b != idcs.end())
      {
         if (TMath::Abs(angles[*a] - angles[*b]) < 1e-5f)
         {
            if (pin[idcs[0]].SquareDistance(pin[*a]) < pin[idcs[0]].SquareDistance(pin[*b]))
               a = b;
         }
         else
         {
            new_idcs.push_back(*a);
            a = b;
         }
         ++b;
      }
      new_idcs.push_back(*a);
      idcs.swap(new_idcs);
   }

   N = idcs.size();

   // Find hull.
   std::vector<Int_t> hull;
   if (N > 2)
   {
      hull.push_back(idcs[0]);
      hull.push_back(idcs[1]);
      hull.push_back(idcs[2]);
      {
         Int_t i = 3;
         while (i < N)
         {
            Int_t n = hull.size() - 1;
            if ((pin[hull[n]] - pin[hull[n-1]]).Cross(pin[idcs[i]] - pin[hull[n]]) > 0)
            {
               hull.push_back(idcs[i]);
               ++i;
            }
            else
            {
               hull.pop_back();
            }
         }
      }
   }
   else
   {
      ::Warning("REveShape::FindConvexHull()", "Polygon reduced to %d points. for '%s'.",
              N, caller ? caller->GetCName() : "unknown");
      hull.swap(idcs);
   }

   // Add hull points into the output vector.
   N = hull.size();
   Int_t Nold = pout.size();
   pout.resize(Nold + N);
   for (Int_t i = 0; i < N; ++i)
   {
      pout[Nold + i] = pin[hull[i]];
   }

   // Print the hull.
   // for (Int_t i = 0; i < N; ++i)
   // {
   //    const REveVector2 &p = pin[hull[i]];
   //    printf("%d [%d] (%5.1f, %5.1f) %f\n", i, hull[i], p.fX, p.fY, angles[hull[i]]);
   // }

   return N;
}

////////////////////////////////////////////////////////////////////////////////
/// Checks if the first face normal is pointing into the other
/// direction as the vector pointing towards the opposite face.
/// This assumes standard box vertex arrangement.

Bool_t REveShape::IsBoxOrientationConsistentEv(const REveVector box[8])
{
   REveVector f1 = box[1] - box[0];
   REveVector f2 = box[3] - box[0];
   REveVector up = box[4] - box[0];

   return up.Dot(f1.Cross(f2)) < 0;
}

////////////////////////////////////////////////////////////////////////////////
/// Checks if the first face normal is pointing into the other
/// direction as the vector pointing towards the opposite face.
/// This assumes standard box vertex arrangement.

Bool_t REveShape::IsBoxOrientationConsistentFv(const Float_t box[8][3])
{
   REveVector b0(box[0]);
   REveVector f1(box[1]); f1 -= b0;
   REveVector f2(box[3]); f2 -= b0;
   REveVector up(box[4]); up -= b0;

   return up.Dot(f1.Cross(f2)) < 0;
}

////////////////////////////////////////////////////////////////////////////////
/// Make sure box orientation is consistent with standard arrangement.

void REveShape::CheckAndFixBoxOrientationEv(REveVector box[8])
{
   if ( ! IsBoxOrientationConsistentEv(box))
   {
      std::swap(box[1], box[3]);
      std::swap(box[5], box[7]);
   }
}

////////////////////////////////////////////////////////////////////////////////
/// Make sure box orientation is consistent with standard arrangement.

void REveShape::CheckAndFixBoxOrientationFv(Float_t box[8][3])
{
   if ( ! IsBoxOrientationConsistentFv(box))
   {
      std::swap(box[1][0], box[3][0]);
      std::swap(box[1][1], box[3][1]);
      std::swap(box[1][2], box[3][2]);
      std::swap(box[5][0], box[7][0]);
      std::swap(box[5][1], box[7][1]);
      std::swap(box[5][2], box[7][2]);
   }
}
