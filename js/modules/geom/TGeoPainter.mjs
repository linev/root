import { httpRequest, browser, source_dir, settings, internals, constants, create, clone,
         findFunction, isBatchMode, isNodeJs, getDocument, isObject, isFunc, isStr, postponePromise, getPromise,
         getKindForType, clTNamed, clTList, clTAxis, clTObjArray, clTPolyMarker3D, clTPolyLine3D,
         clTGeoVolume, clTGeoNode, clTGeoNodeMatrix, nsREX, nsSVG, kInspect } from '../core.mjs';
import { showProgress, injectStyle, ToolbarIcons } from '../gui/utils.mjs';
import { GUI } from '../gui/lil-gui.mjs';
import { THREE, assign3DHandler, disposeThreejsObject, createOrbitControl,
         createLineSegments, InteractiveControl, PointsCreator, importThreeJs,
         createRender3D, beforeRender3D, afterRender3D, getRender3DKind, cleanupRender3D,
         createTextGeometry } from '../base/base3d.mjs';
import { getColor, getRootColors } from '../base/colors.mjs';
import { DrawOptions } from '../base/BasePainter.mjs';
import { ObjectPainter } from '../base/ObjectPainter.mjs';
import { createMenu, closeMenu } from '../gui/menu.mjs';
import { TAxisPainter } from '../gpad/TAxisPainter.mjs';
import { ensureTCanvas } from '../gpad/TCanvasPainter.mjs';
import { kindGeo, kindEve,
         clTGeoBBox, clTGeoCompositeShape,
         geoCfg, geoBITS, ClonedNodes, testGeoBit, setGeoBit, toggleGeoBit, setInvisibleAll,
         countNumShapes, getNodeKind, produceRenderOrder, createServerGeometry,
         projectGeometry, countGeometryFaces, createMaterial, createFrustum, createProjectionMatrix,
         getBoundingBox, provideObjectInfo, isSameStack, checkDuplicates, getObjectName, cleanupShape, getShapeIcon } from './geobase.mjs';


const _ENTIRE_SCENE = 0, _BLOOM_SCENE = 1,
      clTGeoManager = 'TGeoManager', clTEveGeoShapeExtract = 'TEveGeoShapeExtract',
      clTGeoOverlap = 'TGeoOverlap', clTGeoVolumeAssembly = 'TGeoVolumeAssembly',
      clTEveTrack = 'TEveTrack', clTEvePointSet = 'TEvePointSet',
      clREveGeoShapeExtract = `${nsREX}REveGeoShapeExtract`;

/** @summary Function used to build hierarchy of elements of overlap object
  * @private */
function buildOverlapVolume(overlap) {
   const vol = create(clTGeoVolume);

   setGeoBit(vol, geoBITS.kVisDaughters, true);
   vol.$geoh = true; // workaround, let know browser that we are in volumes hierarchy
   vol.fName = '';

   const node1 = create(clTGeoNodeMatrix);
   node1.fName = overlap.fVolume1.fName || 'Overlap1';
   node1.fMatrix = overlap.fMatrix1;
   node1.fVolume = overlap.fVolume1;
   // node1.fVolume.fLineColor = 2; // color assigned with ctrl.split_colors

   const node2 = create(clTGeoNodeMatrix);
   node2.fName = overlap.fVolume2.fName || 'Overlap2';
   node2.fMatrix = overlap.fMatrix2;
   node2.fVolume = overlap.fVolume2;
   // node2.fVolume.fLineColor = 3;  // color assigned with ctrl.split_colors

   vol.fNodes = create(clTList);
   vol.fNodes.Add(node1);
   vol.fNodes.Add(node2);

   return vol;
}

let $comp_col_cnt = 0;

/** @summary Function used to build hierarchy of elements of composite shapes
  * @private */
function buildCompositeVolume(comp, maxlvl, side) {
   if (maxlvl === undefined) maxlvl = 1;
   if (!side) {
      $comp_col_cnt = 0;
      side = '';
   }

   const vol = create(clTGeoVolume);
   setGeoBit(vol, geoBITS.kVisThis, true);
   setGeoBit(vol, geoBITS.kVisDaughters, true);

   if ((side && (comp._typename !== clTGeoCompositeShape)) || (maxlvl <= 0)) {
      vol.fName = side;
      vol.fLineColor = ($comp_col_cnt++ % 8) + 2;
      vol.fShape = comp;
      return vol;
   }

   if (side) side += '/';
   vol.$geoh = true; // workaround, let know browser that we are in volumes hierarchy
   vol.fName = '';

   const node1 = create(clTGeoNodeMatrix);
   setGeoBit(node1, geoBITS.kVisThis, true);
   setGeoBit(node1, geoBITS.kVisDaughters, true);
   node1.fName = 'Left';
   node1.fMatrix = comp.fNode.fLeftMat;
   node1.fVolume = buildCompositeVolume(comp.fNode.fLeft, maxlvl-1, side + 'Left');

   const node2 = create(clTGeoNodeMatrix);
   setGeoBit(node2, geoBITS.kVisThis, true);
   setGeoBit(node2, geoBITS.kVisDaughters, true);
   node2.fName = 'Right';
   node2.fMatrix = comp.fNode.fRightMat;
   node2.fVolume = buildCompositeVolume(comp.fNode.fRight, maxlvl-1, side + 'Right');

   vol.fNodes = create(clTList);
   vol.fNodes.Add(node1);
   vol.fNodes.Add(node2);

   if (!side) $comp_col_cnt = 0;

   return vol;
}


/** @summary Provides 3D rendering configuration from histogram painter
  * @return {Object} with scene, renderer and other attributes
  * @private */
function getHistPainter3DCfg(painter) {
   const main = painter?.getFramePainter();
   if (painter?.mode3d && isFunc(main?.create3DScene) && main?.renderer) {
      let scale_x = 1, scale_y = 1, scale_z = 1,
          offset_x = 0, offset_y = 0, offset_z = 0;

      if (main.scale_xmax > main.scale_xmin) {
         scale_x = 2 * main.size_x3d/(main.scale_xmax - main.scale_xmin);
         offset_x = (main.scale_xmax + main.scale_xmin) / 2 * scale_x;
      }

      if (main.scale_ymax > main.scale_ymin) {
         scale_y = 2 * main.size_y3d/(main.scale_ymax - main.scale_ymin);
         offset_y = (main.scale_ymax + main.scale_ymin) / 2 * scale_y;
      }

      if (main.scale_zmax > main.scale_zmin) {
         scale_z = 2 * main.size_z3d/(main.scale_zmax - main.scale_zmin);
         offset_z = (main.scale_zmax + main.scale_zmin) / 2 * scale_z - main.size_z3d;
      }

      return {
         webgl: main.webgl,
         scene: main.scene,
         scene_width: main.scene_width,
         scene_height: main.scene_height,
         toplevel: main.toplevel,
         renderer: main.renderer,
         camera: main.camera,
         scale_x, scale_y, scale_z,
         offset_x, offset_y, offset_z
      };
  }
}


/** @summary find item with geometry painter
  * @private */
function findItemWithGeoPainter(hitem, test_changes) {
   while (hitem) {
      if (isFunc(hitem._painter?.testGeomChanges)) {
         if (test_changes)
            hitem._painter.testGeomChanges();
         return hitem;
      }
      hitem = hitem._parent;
   }
   return null;
}

/** @summary provide css style for geo object
  * @private */
function provideVisStyle(obj) {
   if ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract))
      return obj.fRnrSelf ? ' geovis_this' : '';

   const vis = !testGeoBit(obj, geoBITS.kVisNone) && testGeoBit(obj, geoBITS.kVisThis);
   let chld = testGeoBit(obj, geoBITS.kVisDaughters);

   if (chld && !obj.fNodes?.arr?.length)
      chld = false;

   if (vis && chld)
      return ' geovis_all';
   if (vis)
      return ' geovis_this';
   if (chld)
      return ' geovis_daughters';
   return '';
}


/** @summary update icons
  * @private */
function updateBrowserIcons(obj, hpainter) {
   if (!obj || !hpainter) return;

   hpainter.forEachItem(m => {
      // update all items with that volume
      if ((obj === m._volume) || (obj === m._geoobj)) {
         m._icon = m._icon.split(' ')[0] + provideVisStyle(obj);
         hpainter.updateTreeNode(m);
      }
   });
}


/** @summary Return stack for the item from list of intersection
  * @private */
function getIntersectStack(item) {
   const obj = item?.object;
   if (!obj) return null;
   if (obj.stack)
      return obj.stack;
   if (obj.stacks && item.instanceId !== undefined && item.instanceId < obj.stacks.length)
      return obj.stacks[item.instanceId];
}

/**
  * @summary Toolbar for geometry painter
  *
  * @private
  */

class Toolbar {

   /** @summary constructor */
   constructor(container, bright, buttons) {
      this.bright = bright;
      this.buttons = buttons;
      this.element = container.append('div').attr('style', 'float: left; box-sizing: border-box; position: relative; bottom: 23px; vertical-align: middle; padding-left: 5px');
   }

   /** @summary add buttons */
   createButtons() {
      const buttonsNames = [];

      this.buttons.forEach(buttonConfig => {
         const buttonName = buttonConfig.name;
         if (!buttonName)
            throw new Error('must provide button name in button config');
         if (buttonsNames.indexOf(buttonName) !== -1)
            throw new Error(`button name ${buttonName} is taken`);

         buttonsNames.push(buttonName);

         const title = buttonConfig.title || buttonConfig.name;

         if (!isFunc(buttonConfig.click))
            throw new Error('must provide button click() function in button config');

         ToolbarIcons.createSVG(this.element, ToolbarIcons[buttonConfig.icon], 16, title, this.bright)
              .on('click', buttonConfig.click)
              .style('position', 'relative')
              .style('padding', '3px 1px');
      });
   }

   /** @summary change brightness */
   changeBrightness(bright) {
      if (this.bright === bright) return;
      this.element.selectAll('*').remove();
      this.bright = bright;
      this.createButtons();
   }

   /** @summary cleanup toolbar */
   cleanup() {
      this.element?.remove();
      delete this.element;
   }

} // class ToolBar


/**
  * @summary geometry drawing control
  *
  * @private
  */

class GeoDrawingControl extends InteractiveControl {

   constructor(mesh, bloom) {
      super();
      this.mesh = mesh?.material ? mesh : null;
      this.bloom = bloom;
   }

   /** @summary set highlight */
   setHighlight(col, indx) {
      return this.drawSpecial(col, indx);
   }

   /** @summary draw special */
   drawSpecial(col, indx) {
      const c = this.mesh;
      if (!c?.material) return;

      if (c.isInstancedMesh) {
         if (c._highlight_mesh) {
            c.remove(c._highlight_mesh);
            delete c._highlight_mesh;
         }

         if (col && indx !== undefined) {
            const h = new THREE.Mesh(c.geometry, c.material.clone());

            if (this.bloom) {
               h.layers.enable(_BLOOM_SCENE);
               h.material.emissive = new THREE.Color(0x00ff00);
            } else {
               h.material.color = new THREE.Color(col);
               h.material.opacity = 1.0;
            }
            const m = new THREE.Matrix4();
            c.getMatrixAt(indx, m);
            h.applyMatrix4(m);
            c.add(h);

            h.jsroot_special = true; // exclude from intersections

            c._highlight_mesh = h;
         }
         return true;
      }

      if (col) {
         if (!c.origin) {
            c.origin = {
              color: c.material.color,
              emissive: c.material.emissive,
              opacity: c.material.opacity,
              width: c.material.linewidth,
              size: c.material.size
           };
         }
         if (this.bloom) {
            c.layers.enable(_BLOOM_SCENE);
            c.material.emissive = new THREE.Color(0x00ff00);
         } else {
            c.material.color = new THREE.Color(col);
            c.material.opacity = 1.0;
         }

         if (c.hightlightWidthScale && !browser.isWin)
            c.material.linewidth = c.origin.width * c.hightlightWidthScale;
         if (c.highlightScale)
            c.material.size = c.origin.size * c.highlightScale;
         return true;
      } else if (c.origin) {
         if (this.bloom) {
            c.material.emissive = c.origin.emissive;
            c.layers.enable(_ENTIRE_SCENE);
         } else {
            c.material.color = c.origin.color;
            c.material.opacity = c.origin.opacity;
         }
         if (c.hightlightWidthScale)
            c.material.linewidth = c.origin.width;
         if (c.highlightScale)
            c.material.size = c.origin.size;
         return true;
      }
   }

} // class GeoDrawingControl


const stageInit = 0, stageCollect = 1, stageWorkerCollect = 2, stageAnalyze = 3, stageCollShapes = 4,
      stageStartBuild = 5, stageWorkerBuild = 6, stageBuild = 7, stageBuildReady = 8, stageWaitMain = 9, stageBuildProj = 10;

/**
 * @summary Painter class for geometries drawing
 *
 * @private
 */

class TGeoPainter extends ObjectPainter {

   #geo_manager;  // TGeoManager instance - if assigned in drawing
   #superimpose;  // set when superimposed with other 3D drawings
   #complete_handler; // callback, assigned by ROOT GeomViewer
   #geom_viewer;  // true when processing drawing from ROOT GeomViewer
   #extra_objects; // TList with extra objects configured for drawing
   #webgl;         // true when normal WebGL drawing is enabled
   #worker;       // extra Worker to run different calculations
   #worker_ready; // is worker started and initialized
   #worker_jobs;  // number of submitted to worker jobs
   #clones;       // instance of ClonedNodes
   #clones_owner; // is instance managed by the painter
   #draw_nodes;   // drawn nodes from geometry
   #build_shapes; // build shapes required for drawings
   #current_face_limit; // current face limit
   #draw_all_nodes; // flag using in drawing
   #draw_nodes_again; // flag set if drawing should be started again when completed
   #drawing_ready; // if drawing completed
   #drawing_log;   // current drawing log information
   #draw_resolveFuncs; // resolve call-backs for start drawing calls
   #start_drawing_time; // time when drawing started
   #start_render_tm; // time when rendering started
   #first_render_tm; // first time when rendering was performed
   #last_render_tm;  // last time when rendering was performed
   #last_render_meshes; // last value of rendered meshes
   #render_resolveFuncs; // resolve call-backs from render calls
   #render_tmout;    // timeout used in Render3D()
   #first_drawing;   // true when very first drawing is performed
   #full_redrawing;  // if full redraw must be performed
   #last_clip_cfg;   // last config of clip panels
   #redraw_timer;    // timer used in redraw
   #did_update;     // flag used in update
   #custom_bounding_box; // custom bounding box for extra objects
   #clip_planes;     // clip planes
   #central_painter; // pointer on central painter
   #subordinate_painters; // list of subordinate painters
   #effectComposer;  // extra composer for special effects, used in EVE
   #bloomComposer;   // extra composer for bloom highlight
   #new_draw_nodes; // temporary list of new draw nodes
   #new_append_nodes; // temporary list of new append nodes
   #more_nodes;      // more nodes from ROOT geometry viewer
   #provided_more_nodes; // staged more nodes from ROOT geometry viewer
   #on_pad;         // true when drawing done on TPad
   #last_manifest;  // last node which was "manifest" via menu
   #last_hidden;    // last node which was "hidden" via menu
   #gui;            // dat.GUI instance
   #toolbar;        // tool buttons
   #controls;       // orbit control
   #highlight_handlers; // highlight handlers
   #animating;      // set when animation started
   #last_camera_position; // last camera position
   #fullgeom_proj;  // full geometry to produce projection
   #selected_mesh;  // used in highlight
   #fog;            // fog for the scene
   #lookat;         // position to which camera looks at
   #scene_size;     // stored scene size to control changes
   #scene_width;    // actual scene width
   #scene_height;   // actual scene width
   #fit_main_area;  // true if drawing must fit to DOM
   #overall_size;   // overall size
   #scene;          // three.js Scene object
   #camera;         // three.js camera object
   #renderer;       // three.js renderer object
   #toplevel;       // three.js top level Object3D
   #camera0pos;     // camera on opposite side
   #vrControllers;  // used in VR display
   #controllersMeshes; // used in VR display
   #dolly;          // used in VR display
   #vrDisplay;      // used in VR display
   #vr_camera_position; // used in VR display
   #vr_camera_rotation; // used in VR display
   #vr_camera_near;  // used in VR display
   #standingMatrix;  // used in VR display
   #raycasterEnd;    // used in VR display
   #raycasterOrigin;  // used in VR display
   #adjust_camera_with_render; // flag to readjust camera when rendering
   #did_cleanup;    // flag set after cleanup

   /** @summary Constructor
     * @param {object|string} dom - DOM element for drawing or element id
     * @param {object} obj - supported TGeo object */
   constructor(dom, obj) {
      let gm;
      if (obj?._typename === clTGeoManager) {
         gm = obj;
         obj = obj.fMasterVolume;
      }

      if (obj?._typename && (obj._typename.indexOf(clTGeoVolume) === 0))
         obj = { _typename: clTGeoNode, fVolume: obj, fName: obj.fName, $geoh: obj.$geoh, _proxy: true };

      super(dom, obj);

      this.#superimpose = Boolean(getHistPainter3DCfg(this.getMainPainter()));
      this.#geo_manager = gm;

      this._no_default_title = true; // do not set title to main DIV
      this.mode3d = true; // indication of 3D mode
      this.drawing_stage = stageInit; //
      this.#drawing_log = 'Init';
      this.ctrl = {
         clipIntersect: true,
         clipVisualize: false,
         clip: [{ name: 'x', enabled: false, value: 0, min: -100, max: 100, step: 1 },
                { name: 'y', enabled: false, value: 0, min: -100, max: 100, step: 1 },
                { name: 'z', enabled: false, value: 0, min: -100, max: 100, step: 1 }],
         _highlight: 0,
         highlight: 0,
         highlight_bloom: 0,
         highlight_scene: 0,
         highlight_color: '#00ff00',
         bloom_strength: 1.5,
         more: 1,
         maxfaces: 0,
         vislevel: undefined,
         maxnodes: undefined,
         dflt_colors: false,

         info: { num_meshes: 0, num_faces: 0, num_shapes: 0 },
         depthTest: true,
         depthMethod: 'dflt',
         select_in_view: false,
         update_browser: true,
         use_fog: false,
         light: { kind: 'points', top: false, bottom: false, left: false, right: false, front: false, specular: true, power: 1 },
         lightKindItems: [
            { name: 'AmbientLight', value: 'ambient' },
            { name: 'DirectionalLight', value: 'points' },
            { name: 'HemisphereLight', value: 'hemisphere' },
            { name: 'Ambient + Point', value: 'mix' }
         ],
         trans_radial: 0,
         trans_z: 0,
         scale: new THREE.Vector3(1, 1, 1),
         zoom: 1.0, rotatey: 0, rotatez: 0,
         depthMethodItems: [
            { name: 'Default', value: 'dflt' },
            { name: 'Raytraicing', value: 'ray' },
            { name: 'Boundary box', value: 'box' },
            { name: 'Mesh size', value: 'size' },
            { name: 'Central point', value: 'pnt' }
          ],
          cameraKindItems: [
            { name: 'Perspective', value: 'perspective' },
            { name: 'Perspective (Floor XOZ)', value: 'perspXOZ' },
            { name: 'Perspective (Floor YOZ)', value: 'perspYOZ' },
            { name: 'Perspective (Floor XOY)', value: 'perspXOY' },
            { name: 'Orthographic (XOY)', value: 'orthoXOY' },
            { name: 'Orthographic (XOZ)', value: 'orthoXOZ' },
            { name: 'Orthographic (ZOY)', value: 'orthoZOY' },
            { name: 'Orthographic (ZOX)', value: 'orthoZOX' },
            { name: 'Orthographic (XnOY)', value: 'orthoXNOY' },
            { name: 'Orthographic (XnOZ)', value: 'orthoXNOZ' },
            { name: 'Orthographic (ZnOY)', value: 'orthoZNOY' },
            { name: 'Orthographic (ZnOX)', value: 'orthoZNOX' }
         ],
         cameraOverlayItems: [
            { name: 'None', value: 'none' },
            { name: 'Bar', value: 'bar' },
            { name: 'Axis', value: 'axis' },
            { name: 'Grid', value: 'grid' },
            { name: 'Grid background', value: 'gridb' },
            { name: 'Grid foreground', value: 'gridf' }
         ],
         camera_kind: 'perspective',
         camera_overlay: 'gridb',
         rotate: false,
         background: settings.DarkMode ? '#000000' : '#ffffff',
         can_rotate: true,
         _axis: 0,
         instancing: 0,
         _count: false,
         // material properties
         wireframe: false,
         transparency: 0,
         flatShading: false,
         roughness: 0.5,
         metalness: 0.5,
         shininess: 0,
         reflectivity: 0.5,
         material_kind: 'lambert',
         materialKinds: [
            { name: 'MeshLambertMaterial', value: 'lambert', emissive: true, props: [{ name: 'flatShading' }] },
            { name: 'MeshBasicMaterial', value: 'basic' },
            { name: 'MeshStandardMaterial', value: 'standard', emissive: true,
                props: [{ name: 'flatShading' }, { name: 'roughness', min: 0, max: 1, step: 0.001 }, { name: 'metalness', min: 0, max: 1, step: 0.001 }] },
            { name: 'MeshPhysicalMaterial', value: 'physical', emissive: true,
               props: [{ name: 'flatShading' }, { name: 'roughness', min: 0, max: 1, step: 0.001 }, { name: 'metalness', min: 0, max: 1, step: 0.001 }, { name: 'reflectivity', min: 0, max: 1, step: 0.001 }] },
            { name: 'MeshPhongMaterial', value: 'phong', emissive: true,
                props: [{ name: 'flatShading' }, { name: 'shininess', min: 0, max: 100, step: 0.1 }] },
            { name: 'MeshNormalMaterial', value: 'normal', props: [{ name: 'flatShading' }] },
            { name: 'MeshDepthMaterial', value: 'depth' },
            { name: 'MeshMatcapMaterial', value: 'matcap' },
            { name: 'MeshToonMaterial', value: 'toon' }
         ],
         getMaterialCfg() {
             let cfg;
             this.materialKinds.forEach(item => {
                if (item.value === this.material_kind)
                   cfg = item;
             });
             return cfg;
         }
      };

      this.#draw_resolveFuncs = [];
      this.#render_resolveFuncs = [];

      this.cleanup(true);
   }

   /** @summary Returns scene */
   getScene() { return this.#scene; }

   /** @summary Returns camera */
   getCamera() { return this.#camera; }

   /** @summary Returns renderer */
   getRenderer() { return this.#renderer; }

   /** @summary Returns top Object3D instance */
   getTopObject3D() { return this.#toplevel; }

   /** @summary Assign geometry viewer mode
    * @private */
   setGeomViewer(on) { this.#geom_viewer = on; }

   /** @summary Assign or remove subordinate painter */
   assignSubordinate(painter, do_assign = true) {
      if (this.#subordinate_painters === undefined)
         this.#subordinate_painters = [];
      const pos = this.#subordinate_painters.indexOf(painter);
      if (do_assign && pos < 0)
         this.#subordinate_painters.push(painter);
      else if (!do_assign && pos >= 0)
         this.#subordinate_painters.splice(pos, 1);
   }

   /** @summary Return list of subordinate painters */
   getSubordinates() { return this.#subordinate_painters ?? []; }

   /** @summary Assign or cleanup central painter */
   assignCentral(painter, do_assign = true) {
      if (do_assign)
         this.#central_painter = painter;
      else if (this.#central_painter === painter)
         this.#central_painter = undefined;
   }

   /** @summary Returns central painter */
   getCentral() { return this.#central_painter; }

   /** @summary Returns extra objects configured for drawing */
   getExtraObjects() { return this.#extra_objects; }

   /** @summary Function called by framework when dark mode is changed
     * @private */
   changeDarkMode(mode) {
      if ((this.ctrl.background === '#000000') || (this.ctrl.background === '#ffffff'))
         this.changedBackground((mode ?? settings.DarkMode) ? '#000000' : '#ffffff');
   }

   /** @summary Change drawing stage
     * @private */
   changeStage(value, msg) {
      this.drawing_stage = value;
      if (!msg) {
         switch (value) {
            case stageInit: msg = 'Building done'; break;
            case stageCollect: msg = 'collect visibles'; break;
            case stageWorkerCollect: msg = 'worker collect visibles'; break;
            case stageAnalyze: msg = 'Analyse visibles'; break;
            case stageCollShapes: msg = 'collect shapes for building'; break;
            case stageStartBuild: msg = 'Start build shapes'; break;
            case stageWorkerBuild: msg = 'Worker build shapes'; break;
            case stageBuild: msg = 'Build shapes'; break;
            case stageBuildReady: msg = 'Build ready'; break;
            case stageWaitMain: msg = 'Wait for main painter'; break;
            case stageBuildProj: msg = 'Build projection'; break;
            default: msg = `stage ${value}`;
         }
      }
      this.#drawing_log = msg;
   }

   /** @summary Check drawing stage */
   isStage(value) { return value === this.drawing_stage; }

   isBatchMode() { return isBatchMode() || this.batch_mode; }

   getControls() { return this.#controls; }

   /** @summary Create toolbar */
   createToolbar() {
      if (this.#toolbar || !this.#webgl || this.ctrl.notoolbar || this.isBatchMode())
         return;
      const buttonList = [{
         name: 'toImage',
         title: 'Save as PNG',
         icon: 'camera',
         click: () => this.createSnapshot()
      }, {
         name: 'control',
         title: 'Toggle control UI',
         icon: 'rect',
         click: () => this.showControlGui('toggle')
      }, {
         name: 'enlarge',
         title: 'Enlarge geometry drawing',
         icon: 'circle',
         click: () => this.toggleEnlarge()
      }];

      // Only show VR icon if WebVR API available.
      if (navigator.getVRDisplays) {
         buttonList.push({
            name: 'entervr',
            title: 'Enter VR (It requires a VR Headset connected)',
            icon: 'vrgoggles',
            click: () => this.toggleVRMode()
         });
         this.initVRMode();
      }

      if (settings.ContextMenu) {
         buttonList.push({
            name: 'menu',
            title: 'Show context menu',
            icon: 'question',
            click: evnt => {
               evnt.preventDefault();
               evnt.stopPropagation();

               if (closeMenu()) return;

               createMenu(evnt, this).then(menu => {
                   menu.painter.fillContextMenu(menu);
                   menu.show();
               });
            }
         });
      }

      const bkgr = new THREE.Color(this.ctrl.background);

      this.#toolbar = new Toolbar(this.selectDom(), (bkgr.r + bkgr.g + bkgr.b) < 1, buttonList);

      this.#toolbar.createButtons();
   }

   /** @summary Initialize VR mode */
   initVRMode() {
      // Dolly contains camera and controllers in VR Mode
      // Allows moving the user in the scene
      this.#dolly = new THREE.Group();
      this.#scene.add(this.#dolly);
      this.#standingMatrix = new THREE.Matrix4();

      // Raycaster temp variables to avoid one per frame allocation.
      this.#raycasterEnd = new THREE.Vector3();
      this.#raycasterOrigin = new THREE.Vector3();

      navigator.getVRDisplays().then(displays => {
         const vrDisplay = displays[0];
         if (!vrDisplay) return;
         this.#renderer.vr.setDevice(vrDisplay);
         this.#vrDisplay = vrDisplay;
         if (vrDisplay.stageParameters)
            this.#standingMatrix.fromArray(vrDisplay.stageParameters.sittingToStandingTransform);

         this.initVRControllersGeometry();
      });
   }

   /** @summary Init VR controllers geometry
     * @private */
   initVRControllersGeometry() {
      const geometry = new THREE.SphereGeometry(0.025, 18, 36),
            material = new THREE.MeshBasicMaterial({ color: 'grey', vertexColors: false }),
            rayMaterial = new THREE.MeshBasicMaterial({ color: 'fuchsia', vertexColors: false }),
            rayGeometry = new THREE.BoxGeometry(0.001, 0.001, 2),
            ray1Mesh = new THREE.Mesh(rayGeometry, rayMaterial),
            ray2Mesh = new THREE.Mesh(rayGeometry, rayMaterial),
            sphere1 = new THREE.Mesh(geometry, material),
            sphere2 = new THREE.Mesh(geometry, material);

      this.#controllersMeshes = [];
      this.#controllersMeshes.push(sphere1);
      this.#controllersMeshes.push(sphere2);
      ray1Mesh.position.z -= 1;
      ray2Mesh.position.z -= 1;
      sphere1.add(ray1Mesh);
      sphere2.add(ray2Mesh);
      this.#dolly.add(sphere1);
      this.#dolly.add(sphere2);
      // Controller mesh hidden by default
      sphere1.visible = false;
      sphere2.visible = false;
   }

   /** @summary Update VR controllers list
     * @private */
   updateVRControllersList() {
      const gamepads = navigator.getGamepads && navigator.getGamepads();
      // Has controller list changed?
      if (this.#vrControllers && (gamepads.length === this.#vrControllers.length)) return;
      // Hide meshes.
      this.#controllersMeshes.forEach(mesh => { mesh.visible = false; });
      this.#vrControllers = [];
      for (let i = 0; i < gamepads.length; ++i) {
         if (!gamepads[i] || !gamepads[i].pose) continue;
         this.#vrControllers.push({
            gamepad: gamepads[i],
            mesh: this.#controllersMeshes[i]
         });
         this.#controllersMeshes[i].visible = true;
      }
   }

   /** @summary Process VR controller intersection
     * @private */
   processVRControllerIntersections() {
      let intersects = [];
      for (let i = 0; i < this.#vrControllers.length; ++i) {
         const controller = this.#vrControllers[i].mesh,
               end = controller.localToWorld(this.#raycasterEnd.set(0, 0, -1)),
               origin = controller.localToWorld(this.#raycasterOrigin.set(0, 0, 0));
         end.sub(origin).normalize();
         intersects = intersects.concat(this.#controls.getOriginDirectionIntersects(origin, end));
      }
      // Remove duplicates.
      intersects = intersects.filter((item, pos) => { return intersects.indexOf(item) === pos; });
      this.#controls.processMouseMove(intersects);
   }

   /** @summary Update VR controllers
     * @private */
   updateVRControllers() {
      this.updateVRControllersList();
      // Update pose.
      for (let i = 0; i < this.#vrControllers.length; ++i) {
         const controller = this.#vrControllers[i],
               orientation = controller.gamepad.pose.orientation,
               position = controller.gamepad.pose.position,
               controllerMesh = controller.mesh;
         if (orientation) controllerMesh.quaternion.fromArray(orientation);
         if (position) controllerMesh.position.fromArray(position);
         controllerMesh.updateMatrix();
         controllerMesh.applyMatrix4(this.#standingMatrix);
         controllerMesh.matrixWorldNeedsUpdate = true;
      }
      this.processVRControllerIntersections();
   }

   /** @summary Toggle VR mode
     * @private */
   toggleVRMode() {
      if (!this.#vrDisplay)
         return;
      // Toggle VR mode off
      if (this.#vrDisplay.isPresenting) {
         this.exitVRMode();
         return;
      }
      this.#vr_camera_position = this.#camera.position.clone();
      this.#vr_camera_rotation = this.#camera.rotation.clone();
      this.#vrDisplay.requestPresent([{ source: this.#renderer.domElement }]).then(() => {
         this.#vr_camera_near = this.#camera.near;
         this.#dolly.position.set(this.#camera.position.x/4, -this.#camera.position.y/8, -this.#camera.position.z/4);
         this.#camera.position.set(0, 0, 0);
         this.#dolly.add(this.#camera);
         this.#camera.near = 0.1;
         this.#camera.updateProjectionMatrix();
         this.#renderer.vr.enabled = true;
         this.#renderer.setAnimationLoop(() => {
            this.updateVRControllers();
            this.render3D(0);
         });
      });
      this.#renderer.vr.enabled = true;

      window.addEventListener('keydown', evnt => {
         // Esc Key turns VR mode off
         if (evnt.code === 'Escape') this.exitVRMode();
      });
   }

   /** @summary Exit VR mode
     * @private */
   exitVRMode() {
      if (!this.#vrDisplay.isPresenting)
         return;
      this.#renderer.vr.enabled = false;
      this.#dolly.remove(this.#camera);
      this.#scene.add(this.#camera);
      // Restore Camera pose
      this.#camera.position.copy(this.#vr_camera_position);
      this.#vr_camera_position = undefined;
      this.#camera.rotation.copy(this.#vr_camera_rotation);
      this.#vr_camera_rotation = undefined;
      this.#camera.near = this.#vr_camera_near;
      this.#camera.updateProjectionMatrix();
      this.#vrDisplay.exitPresent();
   }

   /** @summary Returns main geometry object */
   getGeometry() { return this.getObject(); }

   /** @summary Modify visibility of provided node by name */
   modifyVisisbility(name, sign) {
      if (getNodeKind(this.getGeometry()) !== kindGeo)
         return;

      if (!name)
         return setGeoBit(this.getGeometry().fVolume, geoBITS.kVisThis, (sign === '+'));

      let regexp, exact = false;

      // arg.node.fVolume
      if (name.indexOf('*') < 0) {
         regexp = new RegExp('^'+name+'$');
         exact = true;
      } else {
         regexp = new RegExp('^' + name.split('*').join('.*') + '$');
         exact = false;
      }

      this.findNodeWithVolume(regexp, arg => {
         setInvisibleAll(arg.node.fVolume, (sign !== '+'));
         return exact ? arg : null; // continue search if not exact expression provided
      });
   }

   /** @summary Decode drawing options */
   decodeOptions(opt) {
      if (!isStr(opt))
         opt = '';

      if (this.#superimpose && (opt.indexOf('same') === 0))
         opt = opt.slice(4);

      const res = this.ctrl,

       macro = opt.indexOf('macro:');
      if (macro >= 0) {
         let separ = opt.indexOf(';', macro+6);
         if (separ < 0) separ = opt.length;
         res.script_name = opt.slice(macro+6, separ);
         opt = opt.slice(0, macro) + opt.slice(separ+1);
         console.log(`script ${res.script_name} rest ${opt}`);
      }

      while (true) {
         const pp = opt.indexOf('+'), pm = opt.indexOf('-');
         if ((pp < 0) && (pm < 0)) break;
         let p1 = pp, sign = '+';
         if ((p1 < 0) || ((pm >= 0) && (pm < pp))) { p1 = pm; sign = '-'; }

         let p2 = p1+1;
         const regexp = /[,; .]/;
         while ((p2 < opt.length) && !regexp.test(opt[p2]) && (opt[p2] !== '+') && (opt[p2] !== '-')) p2++;

         const name = opt.substring(p1+1, p2);
         opt = opt.slice(0, p1) + opt.slice(p2);

         this.modifyVisisbility(name, sign);
      }

      const d = new DrawOptions(opt);

      if (d.check('MAIN')) res.is_main = true;

      if (d.check('DUMMY')) res.dummy = true;

      if (d.check('TRACKS')) res.tracks = true; // only for TGeoManager
      if (d.check('SHOWTOP')) res.showtop = true; // only for TGeoManager
      if (d.check('NO_SCREEN')) res.no_screen = true; // ignore kVisOnScreen bits for visibility

      if (d.check('NOINSTANCING')) res.instancing = -1; // disable usage of InstancedMesh
      if (d.check('INSTANCING')) res.instancing = 1; // force usage of InstancedMesh

      if (d.check('ORTHO_CAMERA')) { res.camera_kind = 'orthoXOY'; res.can_rotate = 0; }
      if (d.check('ORTHO', true)) { res.camera_kind = 'ortho' + d.part; res.can_rotate = 0; }
      if (d.check('OVERLAY', true)) res.camera_overlay = d.part.toLowerCase();
      if (d.check('CAN_ROTATE')) res.can_rotate = true;
      if (d.check('PERSPECTIVE')) { res.camera_kind = 'perspective'; res.can_rotate = true; }
      if (d.check('PERSP', true)) { res.camera_kind = 'persp' + d.part; res.can_rotate = true; }
      if (d.check('MOUSE_CLICK')) res.mouse_click = true;

      if (d.check('DEPTHRAY') || d.check('DRAY')) res.depthMethod = 'ray';
      if (d.check('DEPTHBOX') || d.check('DBOX')) res.depthMethod = 'box';
      if (d.check('DEPTHPNT') || d.check('DPNT')) res.depthMethod = 'pnt';
      if (d.check('DEPTHSIZE') || d.check('DSIZE')) res.depthMethod = 'size';
      if (d.check('DEPTHDFLT') || d.check('DDFLT')) res.depthMethod = 'dflt';

      if (d.check('ZOOM', true)) res.zoom = d.partAsFloat(0, 100) / 100;
      if (d.check('ROTY', true)) res.rotatey = d.partAsFloat();
      if (d.check('ROTZ', true)) res.rotatez = d.partAsFloat();

      if (d.check('PHONG')) res.material_kind = 'phong';
      if (d.check('LAMBERT')) res.material_kind = 'lambert';
      if (d.check('MATCAP')) res.material_kind = 'matcap';
      if (d.check('TOON')) res.material_kind = 'toon';

      if (d.check('AMBIENT')) res.light.kind = 'ambient';

      const getCamPart = () => {
         let neg = 1;
         if (d.part[0] === 'N') {
            neg = -1;
            d.part = d.part.slice(1);
         }
         return neg * d.partAsFloat();
      };

      if (d.check('CAMX', true)) res.camx = getCamPart();
      if (d.check('CAMY', true)) res.camy = getCamPart();
      if (d.check('CAMZ', true)) res.camz = getCamPart();
      if (d.check('CAMLX', true)) res.camlx = getCamPart();
      if (d.check('CAMLY', true)) res.camly = getCamPart();
      if (d.check('CAMLZ', true)) res.camlz = getCamPart();

      if (d.check('BLACK')) res.background = '#000000';
      if (d.check('WHITE')) res.background = '#FFFFFF';

      if (d.check('BKGR_', true)) {
         let bckgr = null;
         if (d.partAsInt(1) > 0)
            bckgr = getColor(d.partAsInt());
          else {
            for (let col = 0; col < 8; ++col) {
               if (getColor(col).toUpperCase() === d.part)
                  bckgr = getColor(col);
            }
         }
         if (bckgr) res.background = '#' + new THREE.Color(bckgr).getHexString();
      }

      if (d.check('R3D_', true))
         res.Render3D = constants.Render3D.fromString(d.part.toLowerCase());

      if (d.check('MORE', true)) res.more = d.partAsInt(0, 2) ?? 2;
      if (d.check('ALL')) { res.more = 100; res.vislevel = 99; }

      if (d.check('VISLVL', true)) res.vislevel = d.partAsInt();
      if (d.check('MAXNODES', true)) res.maxnodes = d.partAsInt();
      if (d.check('MAXFACES', true)) res.maxfaces = d.partAsInt();

      if (d.check('CONTROLS') || d.check('CTRL')) res.show_controls = true;

      if (d.check('CLIPXYZ')) res.clip[0].enabled = res.clip[1].enabled = res.clip[2].enabled = true;
      if (d.check('CLIPX')) res.clip[0].enabled = true;
      if (d.check('CLIPY')) res.clip[1].enabled = true;
      if (d.check('CLIPZ')) res.clip[2].enabled = true;
      if (d.check('CLIP')) res.clip[0].enabled = res.clip[1].enabled = res.clip[2].enabled = true;

      if (d.check('PROJX', true)) { res.project = 'x'; if (d.partAsInt(1) > 0) res.projectPos = d.partAsInt(); res.can_rotate = 0; }
      if (d.check('PROJY', true)) { res.project = 'y'; if (d.partAsInt(1) > 0) res.projectPos = d.partAsInt(); res.can_rotate = 0; }
      if (d.check('PROJZ', true)) { res.project = 'z'; if (d.partAsInt(1) > 0) res.projectPos = d.partAsInt(); res.can_rotate = 0; }

      if (d.check('DFLT_COLORS') || d.check('DFLT')) res.dflt_colors = true;
      d.check('SSAO'); // deprecated
      if (d.check('NOBLOOM')) res.highlight_bloom = false;
      if (d.check('BLOOM')) res.highlight_bloom = true;
      if (d.check('OUTLINE')) res.outline = true;

      if (d.check('NOWORKER')) res.use_worker = -1;
      if (d.check('WORKER')) res.use_worker = 1;

      if (d.check('NOFOG')) res.use_fog = false;
      if (d.check('FOG')) res.use_fog = true;

      if (d.check('NOHIGHLIGHT') || d.check('NOHIGH')) res.highlight_scene = res.highlight = false;
      if (d.check('HIGHLIGHT')) res.highlight_scene = res.highlight = true;
      if (d.check('HSCENEONLY')) { res.highlight_scene = true; res.highlight = false; }
      if (d.check('NOHSCENE')) res.highlight_scene = false;
      if (d.check('HSCENE')) res.highlight_scene = true;

      if (d.check('WIREFRAME') || d.check('WIRE')) res.wireframe = true;
      if (d.check('ROTATE')) res.rotate = true;

      if (d.check('INVX') || d.check('INVERTX')) res.scale.x = -1;
      if (d.check('INVY') || d.check('INVERTY')) res.scale.y = -1;
      if (d.check('INVZ') || d.check('INVERTZ')) res.scale.z = -1;

      if (d.check('COUNT')) res._count = true;

      if (d.check('TRANSP', true))
         res.transparency = d.partAsInt(0, 100)/100;

      if (d.check('OPACITY', true))
         res.transparency = 1 - d.partAsInt(0, 100)/100;

      if (d.check('AXISCENTER') || d.check('AXISC') || d.check('AC')) res._axis = 2;
      if (d.check('AXIS') || d.check('A')) res._axis = 1;

      if (d.check('TRR', true)) res.trans_radial = d.partAsInt()/100;
      if (d.check('TRZ', true)) res.trans_z = d.partAsInt()/100;


      if (d.check('W')) res.wireframe = true;
      if (d.check('Y')) res._yup = true;
      if (d.check('Z')) res._yup = false;

      // when drawing geometry without TCanvas, yup = true by default
      if (res._yup === undefined)
         res._yup = this.getCanvSvg().empty();

      // let reuse for storing origin options
      this.setOptions(res, true);
   }

   /** @summary Activate specified items in the browser */
   activateInBrowser(names, force) {
      if (isStr(names))
         names = [names];

      const h = this.getHPainter();

      if (h) {
         // show browser if it not visible

         h.activateItems(names, force);

         // if highlight in the browser disabled, suppress in few seconds
         if (!this.ctrl.update_browser)
            setTimeout(() => h.activateItems([]), 2000);
      }
   }

   /** @summary  Return ClonedNodes instance from the painter */
   getClones() { return this.#clones; }

   /** @summary Assign clones, created outside.
    * @desc Used by ROOT geometry painter, where clones are handled by the server */
   assignClones(clones, owner = true) {
      if (this.#clones_owner)
         this.#clones?.cleanup(this.#draw_nodes, this.#build_shapes);
      this.#draw_nodes = undefined;
      this.#build_shapes = undefined;
      this.#drawing_ready = false;

      this.#clones = clones;
      this.#clones_owner = owner;
   }

   /** @summary  method used to check matrix calculations performance with current three.js model */
   testMatrixes() {
      let errcnt = 0, totalcnt = 0, totalmax = 0;

      const arg = {
         domatrix: true,
         func: (/* node */) => {
            let m2 = this.getmatrix();
            const entry = this.copyStack(),
                  mesh = this.#clones.createObject3D(entry.stack, this.#toplevel, 'mesh');
            if (!mesh) return true;

            totalcnt++;

            const m1 = mesh.matrixWorld;
            if (m1.equals(m2)) return true;
            if ((m1.determinant() > 0) && (m2.determinant() < -0.9)) {
               const flip = new THREE.Vector3(1, 1, -1);
               m2 = m2.clone().scale(flip);
               if (m1.equals(m2)) return true;
            }

            let max = 0;
            for (let k = 0; k < 16; ++k)
               max = Math.max(max, Math.abs(m1.elements[k] - m2.elements[k]));

            totalmax = Math.max(max, totalmax);

            if (max < 1e-4) return true;

            console.log(`${this.#clones.resolveStack(entry.stack).name} maxdiff ${max} determ ${m1.determinant()} ${m2.determinant()}`);

            errcnt++;

            return false;
         }
      }, tm1 = new Date().getTime();

      this.#clones.scanVisible(arg);

      const tm2 = new Date().getTime();

      console.log(`Compare matrixes total ${totalcnt} errors ${errcnt} takes ${tm2-tm1} maxdiff ${totalmax}`);
   }

   /** @summary Fill context menu */
   fillContextMenu(menu) {
      menu.header('Draw options');

      menu.addchk(this.ctrl.update_browser, 'Browser update', () => {
         this.ctrl.update_browser = !this.ctrl.update_browser;
         if (!this.ctrl.update_browser) this.activateInBrowser([]);
      });
      menu.addchk(this.ctrl.show_controls, 'Show Controls', () => this.showControlGui('toggle'));

      menu.sub('Show axes', () => this.setAxesDraw('toggle'));
      menu.addchk(this.ctrl._axis === 0, 'off', 0, arg => this.setAxesDraw(parseInt(arg)));
      menu.addchk(this.ctrl._axis === 1, 'side', 1, arg => this.setAxesDraw(parseInt(arg)));
      menu.addchk(this.ctrl._axis === 2, 'center', 2, arg => this.setAxesDraw(parseInt(arg)));
      menu.endsub();

      if (this.#geo_manager)
         menu.addchk(this.ctrl.showtop, 'Show top volume', () => this.setShowTop(!this.ctrl.showtop));

      menu.addchk(this.ctrl.wireframe, 'Wire frame', () => this.toggleWireFrame());

      if (!this.getCanvPainter())
         menu.addchk(this.isTooltipAllowed(), 'Show tooltips', () => this.setTooltipAllowed('toggle'));

      menu.sub('Highlight');

      menu.addchk(!this.ctrl.highlight, 'Off', () => {
         this.ctrl.highlight = false;
         this.changedHighlight();
      });
      menu.addchk(this.ctrl.highlight && !this.ctrl.highlight_bloom, 'Normal', () => {
         this.ctrl.highlight = true;
         this.ctrl.highlight_bloom = false;
         this.changedHighlight();
      });
      menu.addchk(this.ctrl.highlight && this.ctrl.highlight_bloom, 'Bloom', () => {
         this.ctrl.highlight = true;
         this.ctrl.highlight_bloom = true;
         this.changedHighlight();
      });

      menu.separator();

      menu.addchk(this.ctrl.highlight_scene, 'Scene', flag => {
         this.ctrl.highlight_scene = flag;
         this.changedHighlight();
      });

      menu.endsub();

      menu.sub('Camera');
      menu.add('Reset position', () => this.focusCamera());
      if (!this.ctrl.project)
          menu.addchk(this.ctrl.rotate, 'Autorotate', () => this.setAutoRotate(!this.ctrl.rotate));

      if (!this.#geom_viewer) {
         menu.addchk(this.canRotateCamera(), 'Can rotate', () => this.changeCanRotate(!this.ctrl.can_rotate));

         menu.add('Get position', () => menu.info('Position (as url)', '&opt=' + this.produceCameraUrl()));
         if (!this.isOrthoCamera()) {
            menu.add('Absolute position', () => {
               const url = this.produceCameraUrl(true), p = url.indexOf('camlx');
               menu.info('Position (as url)', '&opt=' + ((p < 0) ? url : url.slice(0, p) + '\n' + url.slice(p)));
            });
         }

         menu.sub('Kind');
         this.ctrl.cameraKindItems.forEach(item =>
            menu.addchk(this.ctrl.camera_kind === item.value, item.name, item.value, arg => {
               this.ctrl.camera_kind = arg;
               this.changeCamera();
            }));
         menu.endsub();

         if (this.isOrthoCamera()) {
            menu.sub('Overlay');
            this.ctrl.cameraOverlayItems.forEach(item =>
               menu.addchk(this.ctrl.camera_overlay === item.value, item.name, item.value, arg => {
                  this.ctrl.camera_overlay = arg;
                  this.changeCamera();
               }));
            menu.endsub();
         }
      }
      menu.endsub();

      menu.addchk(this.ctrl.select_in_view, 'Select in view', () => {
         this.ctrl.select_in_view = !this.ctrl.select_in_view;
         if (this.ctrl.select_in_view) this.startDrawGeometry();
      });
   }

   /** @summary Method used to set transparency for all geometrical shapes
     * @param {number|Function} transparency - one could provide function
     * @param {boolean} [skip_render] - if specified, do not perform rendering */
   changedGlobalTransparency(transparency) {
      const func = isFunc(transparency) ? transparency : null;
      if (func || (transparency === undefined))
         transparency = this.ctrl.transparency;

      this.#toplevel?.traverse(node => {
         // ignore all kind of extra elements
         if (node?.material?.inherentOpacity === undefined)
            return;

         const t = func ? func(node) : undefined;
         if (t !== undefined)
            node.material.opacity = 1 - t;
         else
            node.material.opacity = Math.min(1 - (transparency || 0), node.material.inherentOpacity);

         node.material.depthWrite = node.material.opacity === 1;
         node.material.transparent = node.material.opacity < 1;
      });

      this.render3D();
   }

   /** @summary Method used to interactively change material kinds */
   changedMaterial() {
      this.#toplevel?.traverse(node => {
         // ignore all kind of extra elements
         if (node.material?.inherentArgs !== undefined)
            node.material = createMaterial(this.ctrl, node.material.inherentArgs);
      });

      this.render3D(-1);
   }

   /** @summary Change for all materials that property */
   changeMaterialProperty(name) {
      const value = this.ctrl[name];
      if (value === undefined)
         return console.error('No property ', name);

      this.#toplevel?.traverse(node => {
         // ignore all kind of extra elements
         if (node.material?.inherentArgs === undefined) return;

         if (node.material[name] !== undefined) {
            node.material[name] = value;
            node.material.needsUpdate = true;
         }
      });

      this.render3D();
   }

   /** @summary Reset transformation */
   resetTransformation() {
      this.changedTransformation('reset');
   }

   /** @summary Method should be called when transformation parameters were changed */
   changedTransformation(arg) {
      if (!this.#toplevel) return;

      const ctrl = this.ctrl,
            translation = new THREE.Matrix4(),
            vect2 = new THREE.Vector3();

      if (arg === 'reset')
         ctrl.trans_z = ctrl.trans_radial = 0;

      this.#toplevel.traverse(mesh => {
         if (mesh.stack !== undefined) {
            const node = mesh.parent;

            if (arg === 'reset') {
               if (node.matrix0) {
                  node.matrix.copy(node.matrix0);
                  node.matrix.decompose(node.position, node.quaternion, node.scale);
                  node.matrixWorldNeedsUpdate = true;
               }
               delete node.matrix0;
               delete node.vect0;
               delete node.vect1;
               delete node.minvert;
               return;
            }

            if (node.vect0 === undefined) {
               node.matrix0 = node.matrix.clone();
               node.minvert = new THREE.Matrix4().copy(node.matrixWorld).invert();

               const box3 = getBoundingBox(mesh, null, true),
                   signz = mesh._flippedMesh ? -1 : 1;

               // real center of mesh in local coordinates
               node.vect0 = new THREE.Vector3((box3.max.x + box3.min.x) / 2, (box3.max.y + box3.min.y) / 2, signz * (box3.max.z + box3.min.z) / 2).applyMatrix4(node.matrixWorld);
               node.vect1 = new THREE.Vector3(0, 0, 0).applyMatrix4(node.minvert);
            }

            vect2.set(ctrl.trans_radial * node.vect0.x, ctrl.trans_radial * node.vect0.y, ctrl.trans_z * node.vect0.z).applyMatrix4(node.minvert).sub(node.vect1);

            node.matrix.multiplyMatrices(node.matrix0, translation.makeTranslation(vect2.x, vect2.y, vect2.z));
            node.matrix.decompose(node.position, node.quaternion, node.scale);
            node.matrixWorldNeedsUpdate = true;
         } else if (mesh.stacks !== undefined) {
            mesh.instanceMatrix.needsUpdate = true;

            if (arg === 'reset') {
               mesh.trans?.forEach((item, i) => {
                  mesh.setMatrixAt(i, item.matrix0);
               });
               delete mesh.trans;
               return;
            }

            if (mesh.trans === undefined) {
               mesh.trans = new Array(mesh.count);

               mesh.geometry.computeBoundingBox();

               for (let i = 0; i < mesh.count; i++) {
                  const item = {
                     matrix0: new THREE.Matrix4(),
                     minvert: new THREE.Matrix4()
                  };

                  mesh.trans[i] = item;

                  mesh.getMatrixAt(i, item.matrix0);
                  item.minvert.copy(item.matrix0).invert();

                  const box3 = new THREE.Box3().copy(mesh.geometry.boundingBox).applyMatrix4(item.matrix0);

                  item.vect0 = new THREE.Vector3((box3.max.x + box3.min.x) / 2, (box3.max.y + box3.min.y) / 2, (box3.max.z + box3.min.z) / 2);
                  item.vect1 = new THREE.Vector3(0, 0, 0).applyMatrix4(item.minvert);
               }
            }

            const mm = new THREE.Matrix4();

            mesh.trans?.forEach((item, i) => {
               vect2.set(ctrl.trans_radial * item.vect0.x, ctrl.trans_radial * item.vect0.y, ctrl.trans_z * item.vect0.z).applyMatrix4(item.minvert).sub(item.vect1);

               mm.multiplyMatrices(item.matrix0, translation.makeTranslation(vect2.x, vect2.y, vect2.z));

               mesh.setMatrixAt(i, mm);
            });
         }
      });

      this.#toplevel.updateMatrixWorld();

      // axes drawing always triggers rendering
      if (arg !== 'norender')
         this.drawAxesAndOverlay();
   }

   /** @summary Should be called when auto rotate property changed */
   changedAutoRotate() {
      this.autorotate(2.5);
   }

   /** @summary Method should be called when changing axes drawing */
   changedAxes() {
      if (isStr(this.ctrl._axis))
         this.ctrl._axis = parseInt(this.ctrl._axis);

      this.drawAxesAndOverlay();
   }

   /** @summary Method should be called to change background color */
   changedBackground(val) {
      if (val !== undefined)
         this.ctrl.background = val;
      this.#scene.background = new THREE.Color(this.ctrl.background);
      this.#renderer.setClearColor(this.#scene.background, 1);
      this.render3D(0);

      if (this.#toolbar) {
         const bkgr = new THREE.Color(this.ctrl.background);
         this.#toolbar.changeBrightness((bkgr.r + bkgr.g + bkgr.b) < 1);
      }
   }

   /** @summary Display control GUI */
   showControlGui(on) {
      // while complete geo drawing can be removed until dat is loaded - just check and ignore callback
      if (!this.ctrl) return;

      if (on === 'toggle')
         on = !this.#gui;
       else if (on === undefined)
         on = this.ctrl.show_controls;

      this.ctrl.show_controls = on;

      if (this.#gui) {
         if (!on) {
            this.#gui.destroy();
            this.#gui = undefined;
         }
         return;
      }

      if (!on || !this.#renderer)
         return;

      const main = this.selectDom();
      if (main.style('position') === 'static')
         main.style('position', 'relative');

      this.#gui = new GUI({ container: main.node(), closeFolders: true, width: Math.min(300, this.#scene_width / 2),
                            title: 'Settings' });

      const dom = this.#gui.domElement;
      dom.style.position = 'absolute';
      dom.style.top = 0;
      dom.style.right = 0;

      this.#gui.painter = this;

      const makeLil = items => {
         const lil = {};
         items.forEach(i => { lil[i.name] = i.value; });
         return lil;
      };

      if (!this.ctrl.project) {
         const selection = this.#gui.addFolder('Selection');

         if (!this.ctrl.maxnodes)
            this.ctrl.maxnodes = this.#clones?.getMaxVisNodes() ?? 10000;
         if (!this.ctrl.vislevel)
            this.ctrl.vislevel = this.#clones?.getVisLevel() ?? 3;
         if (!this.ctrl.maxfaces)
            this.ctrl.maxfaces = 200000 * this.ctrl.more;
         this.ctrl.more = 1;

         selection.add(this.ctrl, 'vislevel', 1, 99, 1)
                     .name('Visibility level')
                     .listen().onChange(() => this.startRedraw(500));
         selection.add(this.ctrl, 'maxnodes', 0, 500000, 1000)
                  .name('Visible nodes')
                  .listen().onChange(() => this.startRedraw(500));
         selection.add(this.ctrl, 'maxfaces', 0, 5000000, 100000)
                  .name('Max faces')
                  .listen().onChange(() => this.startRedraw(500));
      }

      if (this.ctrl.project) {
         const bound = this.getGeomBoundingBox(this.getProjectionSource(), 0.01),
             axis = this.ctrl.project;

         if (this.ctrl.projectPos === undefined)
            this.ctrl.projectPos = (bound.min[axis] + bound.max[axis])/2;

         this.#gui.add(this.ctrl, 'projectPos', bound.min[axis], bound.max[axis])
             .name(axis.toUpperCase() + ' projection')
             .onChange(() => this.startDrawGeometry());
      } else {
         // Clipping Options

         const clipFolder = this.#gui.addFolder('Clipping');

         for (let naxis = 0; naxis < 3; ++naxis) {
            const cc = this.ctrl.clip[naxis],
                axisC = cc.name.toUpperCase();

            clipFolder.add(cc, 'enabled')
                .name('Enable ' + axisC)
                .listen().onChange(() => this.changedClipping(-1));

            clipFolder.add(cc, 'value', cc.min, cc.max, cc.step)
                .name(axisC + ' position')
                .listen().onChange(() => this.changedClipping(naxis));
         }

         clipFolder.add(this.ctrl, 'clipIntersect').name('Clip intersection')
                   .onChange(() => this.changedClipping(-1));

         clipFolder.add(this.ctrl, 'clipVisualize').name('Visualize')
                   .onChange(() => this.changedClipping(-1));
      }

      // Scene Options

      const scene = this.#gui.addFolder('Scene');
      // following items used in handlers and cannot be constants
      let light_pnts = null, strength = null, hcolor = null, overlay = null;

      scene.add(this.ctrl.light, 'kind', makeLil(this.ctrl.lightKindItems)).name('Light')
           .listen().onChange(() => {
              light_pnts.show(this.ctrl.light.kind === 'mix' || this.ctrl.light.kind === 'points');
              this.changedLight();
           });

      this.ctrl.light._pnts = this.ctrl.light.specular ? 0 : (this.ctrl.light.front ? 1 : 2);
      light_pnts = scene.add(this.ctrl.light, '_pnts', { specular: 0, front: 1, box: 2 })
                .name('Positions')
                .show(this.ctrl.light.kind === 'mix' || this.ctrl.light.kind === 'points')
                .onChange(v => {
                   this.ctrl.light.specular = (v === 0);
                   this.ctrl.light.front = (v === 1);
                   this.ctrl.light.top = this.ctrl.light.bottom = this.ctrl.light.left = this.ctrl.light.right = (v === 2);
                   this.changedLight();
                });

      scene.add(this.ctrl.light, 'power', 0, 10, 0.01).name('Power')
           .listen().onChange(() => this.changedLight());

      scene.add(this.ctrl, 'use_fog').name('Fog')
           .listen().onChange(() => this.changedUseFog());

      // Appearance Options

      const appearance = this.#gui.addFolder('Appearance');

      this.ctrl._highlight = !this.ctrl.highlight ? 0 : this.ctrl.highlight_bloom ? 2 : 1;
      appearance.add(this.ctrl, '_highlight', { none: 0, normal: 1, bloom: 2 }).name('Highlight Selection')
                .listen().onChange(() => {
                   this.changedHighlight(this.ctrl._highlight);
                   strength.show(this.ctrl._highlight === 2);
                   hcolor.show(this.ctrl._highlight === 1);
                });

      hcolor = appearance.addColor(this.ctrl, 'highlight_color').name('Hightlight color')
                         .show(this.ctrl._highlight === 1);
      strength = appearance.add(this.ctrl, 'bloom_strength', 0, 3).name('Bloom strength')
                           .listen().onChange(() => this.changedHighlight())
                           .show(this.ctrl._highlight === 2);

      appearance.addColor(this.ctrl, 'background').name('Background')
                .onChange(col => this.changedBackground(col));

      appearance.add(this.ctrl, '_axis', { none: 0, side: 1, center: 2 }).name('Axes')
                    .onChange(() => this.changedAxes());

      if (!this.ctrl.project) {
         appearance.add(this.ctrl, 'rotate').name('Autorotate')
                      .listen().onChange(() => this.changedAutoRotate());
      }

      // Material options

      const material = this.#gui.addFolder('Material');
      let material_props = [];

      const addMaterialProp = () => {
         material_props.forEach(f => f.destroy());
         material_props = [];

         const props = this.ctrl.getMaterialCfg()?.props;
         if (!props) return;

         props.forEach(prop => {
            const f = material.add(this.ctrl, prop.name, prop.min, prop.max, prop.step).onChange(() => {
               this.changeMaterialProperty(prop.name);
            });
            material_props.push(f);
         });
      };

      material.add(this.ctrl, 'material_kind', makeLil(this.ctrl.materialKinds)).name('Kind')
              .listen().onChange(() => {
            addMaterialProp();
            this.ensureBloom(false);
            this.changedMaterial();
            this.changedHighlight(); // for some materials bloom will not work
      });

      material.add(this.ctrl, 'transparency', 0, 1, 0.001).name('Transparency')
              .listen().onChange(value => this.changedGlobalTransparency(value));

      material.add(this.ctrl, 'wireframe').name('Wireframe')
              .listen().onChange(() => this.changedWireFrame());

      material.add(this, 'showMaterialDocu').name('Docu from threejs.org');

      addMaterialProp();


      // Camera options
      const camera = this.#gui.addFolder('Camera');

      camera.add(this.ctrl, 'camera_kind', makeLil(this.ctrl.cameraKindItems))
            .name('Kind').listen().onChange(() => {
            overlay.show(this.ctrl.camera_kind.indexOf('ortho') === 0);
            this.changeCamera();
      });

      camera.add(this.ctrl, 'can_rotate').name('Can rotate')
                .listen().onChange(() => this.changeCanRotate());

      camera.add(this, 'focusCamera').name('Reset position');

      overlay = camera.add(this.ctrl, 'camera_overlay', makeLil(this.ctrl.cameraOverlayItems))
                      .name('Overlay').listen().onChange(() => this.changeCamera())
                      .show(this.ctrl.camera_kind.indexOf('ortho') === 0);

      // Advanced Options
      if (this.#webgl) {
         const advanced = this.#gui.addFolder('Advanced');

         advanced.add(this.ctrl, 'depthTest').name('Depth test')
            .listen().onChange(() => this.changedDepthTest());

         advanced.add(this.ctrl, 'depthMethod', makeLil(this.ctrl.depthMethodItems))
             .name('Rendering order')
             .onChange(method => this.changedDepthMethod(method));

         advanced.add(this, 'resetAdvanced').name('Reset');
      }

      // Transformation Options
      if (!this.ctrl.project) {
         const transform = this.#gui.addFolder('Transform');
         transform.add(this.ctrl, 'trans_z', 0.0, 3.0, 0.01)
                     .name('Z axis')
                     .listen().onChange(() => this.changedTransformation());
         transform.add(this.ctrl, 'trans_radial', 0.0, 3.0, 0.01)
                  .name('Radial')
                  .listen().onChange(() => this.changedTransformation());

         transform.add(this, 'resetTransformation').name('Reset');

         if (this.ctrl.trans_z || this.ctrl.trans_radial) transform.open();
      }
   }

   /** @summary show material documentation from https://threejs.org  */
   showMaterialDocu() {
      const cfg = this.ctrl.getMaterialCfg();
      if (cfg?.name && typeof window !== 'undefined')
         window.open('https://threejs.org/docs/index.html#api/en/materials/' + cfg.name, '_blank');
   }

   /** @summary Should be called when configuration of highlight is changed */
   changedHighlight(arg) {
      if (arg !== undefined) {
         this.ctrl.highlight = Boolean(arg);
         if (this.ctrl.highlight)
            this.ctrl.highlight_bloom = (arg === 2);
      }

      this.ensureBloom();

      if (!this.ctrl.highlight)
         this.highlightMesh(null);

      this.getSubordinates()?.forEach(p => {
         p.ctrl.highlight = this.ctrl.highlight;
         p.ctrl.highlight_bloom = this.ctrl.highlight_bloom;
         p.ctrl.bloom_strength = this.ctrl.bloom_strength;
         p.changedHighlight();
      });
   }

   /** @summary Handle change of can rotate */
   changeCanRotate(on) {
      if (on !== undefined)
         this.ctrl.can_rotate = on;
      if (this.#controls)
         this.#controls.enableRotate = this.ctrl.can_rotate;
   }

   /** @summary Change use fog property */
   changedUseFog() {
      this.#scene.fog = this.ctrl.use_fog ? this.#fog : null;

      this.render3D();
   }

   /** @summary Handle change of camera kind */
   changeCamera() {
      // force control recreation
      if (this.#controls) {
          this.#controls.cleanup();
          this.#controls = undefined;
      }

      this.ensureBloom(false);

      // recreate camera
      this.createCamera();

      this.createSpecialEffects();

      // set proper position
      this.adjustCameraPosition(true);

      // this.drawOverlay();

      this.addOrbitControls();

      this.render3D();

      // this.#scene_size = undefined; // ensure reassign of camera position

      // this.#first_drawing = true;
      // this.startDrawGeometry(true);
   }

   /** @summary create bloom effect */
   ensureBloom(on) {
      if (on === undefined) {
         if (this.ctrl.highlight_bloom === 0)
             this.ctrl.highlight_bloom = this.#webgl && !browser.android;

         on = this.ctrl.highlight_bloom && this.ctrl.getMaterialCfg()?.emissive;
      }

      if (on && !this.#bloomComposer) {
         this.#camera.layers.enable(_BLOOM_SCENE);
         this.#bloomComposer = new THREE.EffectComposer(this.#renderer);
         this.#bloomComposer.addPass(new THREE.RenderPass(this.#scene, this.#camera));
         const pass = new THREE.UnrealBloomPass(new THREE.Vector2(this.#scene_width, this.#scene_height), 1.5, 0.4, 0.85);
         pass.threshold = 0;
         pass.radius = 0;
         pass.renderToScreen = true;
         this.#bloomComposer.addPass(pass);
         this.#renderer.autoClear = false;
      } else if (!on && this.#bloomComposer) {
         this.#bloomComposer.dispose();
         this.#bloomComposer = undefined;
         if (this.#renderer)
            this.#renderer.autoClear = true;
         this.#camera?.layers.disable(_BLOOM_SCENE);
         this.#camera?.layers.set(_ENTIRE_SCENE);
      }

      if (this.#bloomComposer?.passes)
         this.#bloomComposer.passes[1].strength = this.ctrl.bloom_strength;
   }


   /** @summary Show context menu for orbit control
     * @private */
   orbitContext(evnt, intersects) {
      createMenu(evnt, this).then(menu => {
         let numitems = 0, numnodes = 0, cnt = 0;
         if (intersects) {
            for (let n = 0; n < intersects.length; ++n) {
               if (getIntersectStack(intersects[n])) numnodes++;
               if (intersects[n].geo_name) numitems++;
            }
         }

         if (numnodes + numitems === 0)
            this.fillContextMenu(menu);
          else {
            const many = (numnodes + numitems) > 1;

            if (many) menu.header((numitems > 0) ? 'Items' : 'Nodes');

            for (let n = 0; n < intersects.length; ++n) {
               const obj = intersects[n].object,
                     stack = getIntersectStack(intersects[n]);
               let name, itemname, hdr;

               if (obj.geo_name) {
                  itemname = obj.geo_name;
                  if (itemname.indexOf('<prnt>') === 0)
                     itemname = (this.getItemName() || 'top') + itemname.slice(6);
                  name = itemname.slice(itemname.lastIndexOf('/')+1);
                  if (!name) name = itemname;
                  hdr = name;
               } else if (stack) {
                  name = this.#clones.getStackName(stack);
                  itemname = this.getStackFullName(stack);
                  hdr = this.getItemName();
                  if (name.indexOf('Nodes/') === 0)
                     hdr = name.slice(6);
                  else if (name)
                     hdr = name;
                  else if (!hdr)
                     hdr = 'header';
               } else
                  continue;


               cnt++;

               menu.add((many ? 'sub:' : 'header:') + hdr, itemname, arg => this.activateInBrowser([arg], true));

               menu.add('Browse', itemname, arg => this.activateInBrowser([arg], true));

               if (this.getHPainter())
                  menu.add('Inspect', itemname, arg => this.getHPainter().display(arg, kInspect));

               if (isFunc(this.hidePhysicalNode)) {
                  menu.add('Hide', itemname, arg => this.hidePhysicalNode([arg]));
                  if (cnt > 1) {
                     menu.add('Hide all before', n, indx => {
                        const items = [];
                        for (let i = 0; i < indx; ++i) {
                           const stack2 = getIntersectStack(intersects[i]);
                           if (stack2) items.push(this.getStackFullName(stack2));
                        }
                        this.hidePhysicalNode(items);
                     });
                  }
               } else if (obj.geo_name) {
                  menu.add('Hide', n, indx => {
                     const mesh = intersects[indx].object;
                     mesh.visible = false; // just disable mesh
                     if (mesh.geo_object) mesh.geo_object.$hidden_via_menu = true; // and hide object for further redraw
                     menu.painter.render3D();
                  }, 'Hide this physical node');

                  if (many) menu.endsub();

                  continue;
               }

               const wireframe = this.accessObjectWireFrame(obj);
               if (wireframe !== undefined) {
                  menu.addchk(wireframe, 'Wireframe', n, indx => {
                     const m = intersects[indx].object.material;
                     m.wireframe = !m.wireframe;
                     this.render3D();
                  }, 'Toggle wireframe mode for the node');
               }

               if (cnt > 1) {
                  menu.add('Manifest', n, indx => {
                     if (this.#last_manifest)
                        this.#last_manifest.wireframe = !this.#last_manifest.wireframe;

                     this.#last_hidden?.forEach(obj2 => { obj2.visible = true; });

                     this.#last_hidden = [];

                     for (let i = 0; i < indx; ++i)
                        this.#last_hidden.push(intersects[i].object);

                     this.#last_hidden.forEach(obj2 => { obj2.visible = false; });

                     this.#last_manifest = intersects[indx].object.material;

                     this.#last_manifest.wireframe = !this.#last_manifest.wireframe;

                     this.render3D();
                  }, 'Manifest selected node');
               }

               menu.add('Focus', n, indx => {
                  this.focusCamera(intersects[indx].object);
               });

               if (!this.#geom_viewer) {
                  menu.add('Hide', n, indx => {
                     const resolve = this.#clones.resolveStack(intersects[indx].object.stack);
                     if (resolve.obj && (resolve.node.kind === kindGeo) && resolve.obj.fVolume) {
                        setGeoBit(resolve.obj.fVolume, geoBITS.kVisThis, false);
                        updateBrowserIcons(resolve.obj.fVolume, this.getHPainter());
                     } else if (resolve.obj && (resolve.node.kind === kindEve)) {
                        resolve.obj.fRnrSelf = false;
                        updateBrowserIcons(resolve.obj, this.getHPainter());
                     }

                     this.testGeomChanges();// while many volumes may disappear, recheck all of them
                  }, 'Hide all logical nodes of that kind');
                  menu.add('Hide only this', n, indx => {
                     this.#clones.setPhysNodeVisibility(getIntersectStack(intersects[indx]), false);
                     this.testGeomChanges();
                  }, 'Hide only this physical node');
                  if (n > 1) {
                    menu.add('Hide all before', n, indx => {
                        for (let k = 0; k < indx; ++k)
                           this.#clones.setPhysNodeVisibility(getIntersectStack(intersects[k]), false);
                        this.testGeomChanges();
                     }, 'Hide all physical nodes before that');
                  }
               }

               if (many) menu.endsub();
            }
         }
         menu.show();
      });
   }

   /** @summary Filter some objects from three.js intersects array */
   filterIntersects(intersects) {
      if (!intersects?.length)
         return intersects;

      // check redirection
      for (let n = 0; n < intersects.length; ++n) {
         if (intersects[n].object.geo_highlight)
            intersects[n].object = intersects[n].object.geo_highlight;
      }

      // remove all elements without stack - indicator that this is geometry object
      // also remove all objects which are mostly transparent
      for (let n = intersects.length - 1; n >= 0; --n) {
         const obj = intersects[n].object;
         let unique = obj.visible && (getIntersectStack(intersects[n]) || (obj.geo_name !== undefined));

         if (unique && obj.material && (obj.material.opacity !== undefined))
            unique = (obj.material.opacity >= 0.1);

         if (obj.jsroot_special) unique = false;

         for (let k = 0; (k < n) && unique; ++k) {
            if (intersects[k].object === obj)
               unique = false;
         }

         if (!unique) intersects.splice(n, 1);
      }

      const clip = this.ctrl.clip;

      if (clip[0].enabled || clip[1].enabled || clip[2].enabled) {
         const clippedIntersects = [];

         for (let i = 0; i < intersects.length; ++i) {
            const point = intersects[i].point, special = (intersects[i].object.type === 'Points');
            let clipped = true;

            if (clip[0].enabled && ((this.#clip_planes[0].normal.dot(point) > this.#clip_planes[0].constant) ^ special)) clipped = false;
            if (clip[1].enabled && ((this.#clip_planes[1].normal.dot(point) > this.#clip_planes[1].constant) ^ special)) clipped = false;
            if (clip[2].enabled && (this.#clip_planes[2].normal.dot(point) > this.#clip_planes[2].constant)) clipped = false;

            if (!clipped) clippedIntersects.push(intersects[i]);
         }

         intersects = clippedIntersects;
      }

      return intersects;
   }

   /** @summary test camera position
     * @desc function analyzes camera position and start redraw of geometry
     *  if objects in view may be changed */
   testCameraPositionChange() {
      if (!this.ctrl.select_in_view || this.#draw_all_nodes)
         return;

      const matrix = createProjectionMatrix(this.#camera),
            frustum = createFrustum(matrix);

      // check if overall bounding box seen
      if (!frustum.CheckBox(this.getGeomBoundingBox()))
         this.startDrawGeometry();
   }

   /** @summary Resolve stack */
   resolveStack(stack) {
      return this.#clones && stack ? this.#clones.resolveStack(stack) : null;
   }

   /** @summary Returns stack full name
     * @desc Includes item name of top geo object */
   getStackFullName(stack) {
      const mainitemname = this.getItemName(),
          sub = this.resolveStack(stack);
      if (!sub || !sub.name)
         return mainitemname;
      return mainitemname ? mainitemname + '/' + sub.name : sub.name;
   }

   /** @summary Add handler which will be called when element is highlighted in geometry drawing
     * @desc Handler should have highlightMesh function with same arguments as TGeoPainter  */
   addHighlightHandler(handler) {
      if (!isFunc(handler?.highlightMesh))
         return;
      if (!this.#highlight_handlers)
         this.#highlight_handlers = [];
      this.#highlight_handlers.push(handler);
   }

   /** @summary perform mesh highlight */
   highlightMesh(active_mesh, color, geo_object, geo_index, geo_stack, no_recursive) {
      if (geo_object) {
         active_mesh = active_mesh ? [active_mesh] : [];
         const extras = this.getExtrasContainer();
         if (extras) {
            extras.traverse(obj3d => {
               if ((obj3d.geo_object === geo_object) && (active_mesh.indexOf(obj3d) < 0))
                  active_mesh.push(obj3d);
            });
         }
      } else if (geo_stack && this.#toplevel) {
         active_mesh = [];
         this.#toplevel.traverse(mesh => {
            if ((mesh instanceof THREE.Mesh) && isSameStack(mesh.stack, geo_stack))
               active_mesh.push(mesh);
         });
      } else
         active_mesh = active_mesh ? [active_mesh] : [];

      if (!active_mesh.length)
         active_mesh = null;

      if (active_mesh) {
         // check if highlight is disabled for correspondent objects kinds
         if (active_mesh[0].geo_object) {
            if (!this.ctrl.highlight_scene)
               active_mesh = null;
         } else
            if (!this.ctrl.highlight)
               active_mesh = null;
      }

      if (!no_recursive) {
         // check all other painters

         if (active_mesh) {
            if (!geo_object) geo_object = active_mesh[0].geo_object;
            if (!geo_stack) geo_stack = active_mesh[0].stack;
         }

         const lst = this.#highlight_handlers || this.getCentral()?.getSubordinates().concat([this.getCentral()]) || this.getSubordinates();

         for (let k = 0; k < lst?.length; ++k) {
            if (lst[k] !== this)
               lst[k].highlightMesh(null, color, geo_object, geo_index, geo_stack, true);
         }
      }

      const curr_mesh = this.#selected_mesh;
      if (!curr_mesh && !active_mesh)
         return false;

      const get_ctrl = mesh => mesh.get_ctrl ? mesh.get_ctrl() : new GeoDrawingControl(mesh, this.ctrl.highlight_bloom && this.#bloomComposer);

      let same = false;

      // check if selections are the same
      if (curr_mesh && active_mesh && (curr_mesh.length === active_mesh.length)) {
         same = true;
         for (let k = 0; (k < curr_mesh.length) && same; ++k) {
            if ((curr_mesh[k] !== active_mesh[k]) || get_ctrl(curr_mesh[k]).checkHighlightIndex(geo_index))
               same = false;
         }
      }
      if (same)
         return Boolean(curr_mesh);

      curr_mesh?.forEach(mesh => get_ctrl(mesh).setHighlight());

      this.#selected_mesh = active_mesh;

      active_mesh?.forEach(mesh => get_ctrl(mesh).setHighlight(color || new THREE.Color(this.ctrl.highlight_color), geo_index));

      this.render3D(0);

      return Boolean(active_mesh);
   }

   /** @summary handle mouse click event */
   processMouseClick(pnt, intersects, evnt) {
      if (!intersects.length)
         return;

      const mesh = intersects[0].object;
      if (!mesh.get_ctrl)
         return;

      const ctrl = mesh.get_ctrl(),
            click_indx = ctrl.extractIndex(intersects[0]);

      ctrl.evnt = evnt;

      if (ctrl.setSelected('blue', click_indx))
         this.render3D();

      ctrl.evnt = null;
   }

   /** @summary Configure mouse delay, required for complex geometries */
   setMouseTmout(val) {
      if (this.ctrl)
         this.ctrl.mouse_tmout = val;

      if (this.#controls)
         this.#controls.mouse_tmout = val;
   }

   /** @summary Configure depth method, used for render order production.
     * @param {string} method - Allowed values: 'ray', 'box','pnt', 'size', 'dflt' */
   setDepthMethod(method) {
      if (this.ctrl)
         this.ctrl.depthMethod = method;
   }

   /** @summary Returns if camera can rotated */
   canRotateCamera() {
      if (this.ctrl.can_rotate === false)
         return false;
      if (!this.ctrl.can_rotate && (this.isOrthoCamera() || this.ctrl.project))
         return false;
      return true;
   }

   /** @summary Add orbit control */
   addOrbitControls() {
      if (this.#controls || !this.#webgl || this.isBatchMode() || this.#superimpose || isNodeJs()) return;

      if (!this.getCanvPainter())
         this.setTooltipAllowed(settings.Tooltip);

      this.#controls = createOrbitControl(this, this.#camera, this.#scene, this.#renderer, this.#lookat);

      this.#controls.mouse_tmout = this.ctrl.mouse_tmout; // set larger timeout for geometry processing

      if (!this.canRotateCamera())
         this.#controls.enableRotate = false;

      this.#controls.contextMenu = this.orbitContext.bind(this);

      this.#controls.processMouseMove = intersects => {
         // painter already cleaned up, ignore any incoming events
         if (!this.ctrl || !this.#controls) return;

         let active_mesh = null, tooltip = null, resolve = null, names = [], geo_object, geo_index, geo_stack;

         // try to find mesh from intersections
         for (let k = 0; k < intersects.length; ++k) {
            const obj = intersects[k].object, stack = getIntersectStack(intersects[k]);
            if (!obj || !obj.visible) continue;
            let info = null;
            if (obj.geo_object)
               info = obj.geo_name;
            else if (stack)
               info = this.getStackFullName(stack);
            if (!info) continue;

            if (info.indexOf('<prnt>') === 0)
               info = this.getItemName() + info.slice(6);

            names.push(info);

            if (!active_mesh) {
               active_mesh = obj;
               tooltip = info;
               geo_object = obj.geo_object;
               if (obj.get_ctrl) {
                  geo_index = obj.get_ctrl().extractIndex(intersects[k]);
                  if ((geo_index !== undefined) && isStr(tooltip))
                     tooltip += ' indx:' + JSON.stringify(geo_index);
               }
               geo_stack = stack;

               if (geo_stack) {
                  resolve = this.resolveStack(geo_stack);
                  if (obj.stacks) geo_index = intersects[k].instanceId;
               }
            }
         }

         this.highlightMesh(active_mesh, undefined, geo_object, geo_index);

         if (this.ctrl.update_browser) {
            if (this.ctrl.highlight && tooltip) names = [tooltip];
            this.activateInBrowser(names);
         }

         if (!resolve?.obj)
            return tooltip;

         const lines = provideObjectInfo(resolve.obj);
         lines.unshift(tooltip);

         return { name: resolve.obj.fName, title: resolve.obj.fTitle || resolve.obj._typename, lines };
      };

      this.#controls.processMouseLeave = function() {
         this.processMouseMove([]); // to disable highlight and reset browser
      };

      this.#controls.processDblClick = () => {
         // painter already cleaned up, ignore any incoming events
         if (!this.ctrl || !this.#controls) return;

         if (this.#last_manifest) {
            this.#last_manifest.wireframe = !this.#last_manifest.wireframe;
            if (this.#last_hidden)
               this.#last_hidden.forEach(obj => { obj.visible = true; });
            this.#last_hidden = undefined;
            this.#last_manifest = undefined;
         } else
            this.adjustCameraPosition(true);

         this.render3D();
      };
   }

   /** @summary Main function in geometry creation loop
     * @desc Returns:
     * - false when nothing todo
     * - true if one could perform next action immediately
     * - 1 when call after short timeout required
     * - 2 when call must be done from processWorkerReply */
   nextDrawAction() {
      if (!this.#clones || this.isStage(stageInit))
         return false;

      if (this.isStage(stageCollect)) {
         if (this.#geom_viewer) {
            this.#draw_all_nodes = false;
            this.changeStage(stageAnalyze);
            return true;
         }

         // wait until worker is really started
         if (this.ctrl.use_worker > 0) {
            if (!this.#worker) {
               this.startWorker();
               return 1;
            }
            if (!this.#worker_ready)
               return 1;
         }

         // first copy visibility flags and check how many unique visible nodes exists
         let numvis = this.#first_drawing ? this.#clones.countVisibles() : 0,
             matrix = null, frustum = null;

         if (!numvis)
            numvis = this.#clones.markVisibles(false, false, Boolean(this.#geo_manager) && !this.ctrl.showtop);

         if (this.ctrl.select_in_view && !this.#first_drawing) {
            // extract camera projection matrix for selection

            matrix = createProjectionMatrix(this.#camera);

            frustum = createFrustum(matrix);

            // check if overall bounding box seen
            if (frustum.CheckBox(this.getGeomBoundingBox())) {
               matrix = null; // not use camera for the moment
               frustum = null;
            }
         }

         this.#current_face_limit = this.ctrl.maxfaces;
         if (matrix) this.#current_face_limit *= 1.25;

         // here we decide if we need worker for the drawings
         // main reason - too large geometry and large time to scan all camera positions
         let need_worker = !this.isBatchMode() && browser.isChrome && ((numvis > 10000) || (matrix && (this.#clones.scanVisible() > 1e5)));

         // worker does not work when starting from file system
         if (need_worker && source_dir.indexOf('file://') === 0) {
            console.log('disable worker for jsroot from file system');
            need_worker = false;
         }

         if (need_worker && !this.#worker && (this.ctrl.use_worker >= 0))
            this.startWorker(); // we starting worker, but it may not be ready so fast

         if (!need_worker || !this.#worker_ready) {
            const res = this.#clones.collectVisibles(this.#current_face_limit, frustum);
            this.#new_draw_nodes = res.lst;
            this.#draw_all_nodes = res.complete;
            this.changeStage(stageAnalyze);
            return true;
         }

         const job = {
            collect: this.#current_face_limit,   // indicator for the command
            flags: this.#clones.getVisibleFlags(),
            matrix: matrix ? matrix.elements : null,
            vislevel: this.#clones.getVisLevel(),
            maxvisnodes: this.#clones.getMaxVisNodes()
         };

         this.submitToWorker(job);

         this.changeStage(stageWorkerCollect);

         return 2; // we now waiting for the worker reply
      }

      if (this.isStage(stageWorkerCollect)) {
         // do nothing, we are waiting for worker reply
         return 2;
      }

      if (this.isStage(stageAnalyze)) {
         // here we merge new and old list of nodes for drawing,
         // normally operation is fast and can be implemented with one c

         if (this.#new_append_nodes) {
            this.#new_draw_nodes = this.#draw_nodes.concat(this.#new_append_nodes);

            this.#new_append_nodes = undefined;
         } else if (this.#draw_nodes) {
            let del;
            if (this.#geom_viewer)
               del = this.#draw_nodes;
            else
               del = this.#clones.mergeVisibles(this.#new_draw_nodes, this.#draw_nodes);

            // remove should be fast, do it here
            for (let n = 0; n < del.length; ++n)
               this.#clones.createObject3D(del[n].stack, this.#toplevel, 'delete_mesh');

            if (del.length)
               this.#drawing_log = `Delete ${del.length} nodes`;
         }

         this.#draw_nodes = this.#new_draw_nodes;
         this.#new_draw_nodes = undefined;
         this.changeStage(stageCollShapes);
         return true;
      }

      if (this.isStage(stageCollShapes)) {
         // collect shapes
         const shapes = this.#clones.collectShapes(this.#draw_nodes);

         // merge old and new list with produced shapes
         this.#build_shapes = this.#clones.mergeShapesLists(this.#build_shapes, shapes);

         this.changeStage(stageStartBuild);
         return true;
      }

      if (this.isStage(stageStartBuild)) {
         // this is building of geometries,
         // one can ask worker to build them or do it ourself

         if (this.canSubmitToWorker()) {
            const job = { limit: this.#current_face_limit, shapes: [] };
            let cnt = 0;
            for (let n = 0; n < this.#build_shapes.length; ++n) {
               const item = this.#build_shapes[n];
               // only submit not-done items
               if (item.ready || item.geom) {
                  // this is place holder for existing geometry
                  job.shapes.push({ id: item.id, ready: true, nfaces: countGeometryFaces(item.geom), refcnt: item.refcnt });
               } else {
                  job.shapes.push(clone(item, null, true));
                  cnt++;
               }
            }

            if (cnt > 0) {
               // only if some geom missing, submit job to the worker
               this.submitToWorker(job);
               this.changeStage(stageWorkerBuild);
               return 2;
            }
         }

         this.changeStage(stageBuild);
      }

      if (this.isStage(stageWorkerBuild)) {
         // waiting shapes from the worker, worker should activate our code
         return 2;
      }

      if (this.isStage(stageBuild) || this.isStage(stageBuildReady)) {
         if (this.isStage(stageBuild)) {
            // building shapes

            const res = this.#clones.buildShapes(this.#build_shapes, this.#current_face_limit, 500);
            if (res.done) {
               this.ctrl.info.num_shapes = this.#build_shapes.length;
               this.changeStage(stageBuildReady);
            } else {
               this.ctrl.info.num_shapes = res.shapes;
               this.#drawing_log = `Creating: ${res.shapes} / ${this.#build_shapes.length} shapes,  ${res.faces} faces`;
               return true;
               // if (res.notusedshapes < 30) return true;
            }
         }

         // final stage, create all meshes

         const tm0 = new Date().getTime(),
               toplevel = this.ctrl.project ? this.#fullgeom_proj : this.#toplevel;
         let build_instanced = false, ready = true;

         if (!this.ctrl.project)
            build_instanced = this.#clones.createInstancedMeshes(this.ctrl, toplevel, this.#draw_nodes, this.#build_shapes, getRootColors());

         if (!build_instanced) {
            for (let n = 0; n < this.#draw_nodes.length; ++n) {
               const entry = this.#draw_nodes[n];
               if (entry.done) continue;

               // shape can be provided with entry itself
               const shape = entry.server_shape || this.#build_shapes[entry.shapeid];

               this.createEntryMesh(entry, shape, toplevel);

               const tm1 = new Date().getTime();
               if (tm1 - tm0 > 500) { ready = false; break; }
            }
         }

         if (ready) {
            if (this.ctrl.project) {
               this.changeStage(stageBuildProj);
               return true;
            }
            this.changeStage(stageInit);
            return false;
         }

         if (!this.isStage(stageBuild))
            this.#drawing_log = `Building meshes ${this.ctrl.info.num_meshes} / ${this.ctrl.info.num_faces}`;
         return true;
      }

      if (this.isStage(stageWaitMain)) {
         // wait for main painter to be ready
         if (!this.getCentral()) {
            this.changeStage(stageInit, 'Lost main painter');
            return false;
         }
         if (!this.getCentral().isDrawingReady())
            return 1;

         this.changeStage(stageBuildProj); // just do projection
      }

      if (this.isStage(stageBuildProj)) {
         this.doProjection();
         this.changeStage(stageInit);
         return false;
      }

      console.error(`never come here, stage ${this.drawing_stage}`);

      return false;
   }

   /** @summary Insert appropriate mesh for given entry */
   createEntryMesh(entry, shape, toplevel) {
      // workaround for the TGeoOverlap, where two branches should get predefined color
      if (this.ctrl.split_colors && entry.stack) {
         if (entry.stack[0] === 0)
            entry.custom_color = 'green';
         else if (entry.stack[0] === 1)
            entry.custom_color = 'blue';
      }

      this.#clones.createEntryMesh(this.ctrl, toplevel, entry, shape, getRootColors());

      return true;
   }

   /** @summary used by geometry viewer to show more nodes
     * @desc These nodes excluded from selection logic and always inserted into the model
     * Shape already should be created and assigned to the node */
   appendMoreNodes(nodes, from_drawing) {
      if (!this.isStage(stageInit) && !from_drawing) {
         this.#provided_more_nodes = nodes;
         return;
      }

      // delete old nodes
      if (this.#more_nodes) {
         for (let n = 0; n < this.#more_nodes.length; ++n) {
            const entry = this.#more_nodes[n],
                obj3d = this.#clones.createObject3D(entry.stack, this.#toplevel, 'delete_mesh');
            disposeThreejsObject(obj3d);
            cleanupShape(entry.server_shape);
            delete entry.server_shape;
         }
         this.#more_nodes = undefined;
      }

      if (!nodes) return;

      const real_nodes = [];
      for (let k = 0; k < nodes.length; ++k) {
         const entry = nodes[k],
             shape = entry.server_shape;
         if (!shape?.ready) continue;

         if (this.createEntryMesh(entry, shape, this.#toplevel))
            real_nodes.push(entry);
      }

      // remember additional nodes only if they include shape - otherwise one can ignore them
      if (real_nodes.length)
         this.#more_nodes = real_nodes;

      if (!from_drawing)
         this.render3D();
   }

   /** @summary Returns hierarchy of 3D objects used to produce projection.
     * @desc Typically external master painter is used, but also internal data can be used */
   getProjectionSource() {
      if (this.#clones_owner)
         return this.#fullgeom_proj;
      if (!this.getCentral()?.isDrawingReady()) {
         console.warn('MAIN PAINTER NOT READY WHEN DO PROJECTION');
         return null;
      }
      return this.getCentral().#toplevel;
   }

   /** @summary Extend custom geometry bounding box */
   extendCustomBoundingBox(box) {
      if (!box) return;
      if (!this.#custom_bounding_box)
         this.#custom_bounding_box = new THREE.Box3().makeEmpty();

      const origin = this.#custom_bounding_box.clone();
      this.#custom_bounding_box.union(box);

      if (!this.#custom_bounding_box.equals(origin))
         this.#adjust_camera_with_render = true;
   }

   /** @summary Calculate geometry bounding box */
   getGeomBoundingBox(topitem, scalar) {
      const box3 = new THREE.Box3(), check_any = !this.#clones;
      if (topitem === undefined)
         topitem = this.#toplevel;

      box3.makeEmpty();

      if (this.#custom_bounding_box && (topitem === this.#toplevel)) {
         box3.union(this.#custom_bounding_box);
         return box3;
      }

      if (!topitem) {
         box3.min.x = box3.min.y = box3.min.z = -1;
         box3.max.x = box3.max.y = box3.max.z = 1;
         return box3;
      }

      topitem.traverse(mesh => {
         if (check_any || (mesh.stack && (mesh instanceof THREE.Mesh)) ||
             (mesh.main_track && (mesh instanceof THREE.LineSegments)) || (mesh.stacks && (mesh instanceof THREE.InstancedMesh)))
            getBoundingBox(mesh, box3);
      });

      if (scalar === 'original') {
         box3.translate(new THREE.Vector3(-topitem.position.x, -topitem.position.y, -topitem.position.z));
         box3.min.multiply(new THREE.Vector3(1/topitem.scale.x, 1/topitem.scale.y, 1/topitem.scale.z));
         box3.max.multiply(new THREE.Vector3(1/topitem.scale.x, 1/topitem.scale.y, 1/topitem.scale.z));
      } else if (scalar !== undefined)
         box3.expandByVector(box3.getSize(new THREE.Vector3()).multiplyScalar(scalar));

      return box3;
   }

   /** @summary Create geometry projection */
   doProjection() {
      const toplevel = this.getProjectionSource();

      if (!toplevel) return false;

      disposeThreejsObject(this.#toplevel, true);

      // let axis = this.ctrl.project;

      if (this.ctrl.projectPos === undefined) {
         const bound = this.getGeomBoundingBox(toplevel),
               min = bound.min[this.ctrl.project], max = bound.max[this.ctrl.project];
         let mean = (min + max)/2;

         if ((min < 0) && (max > 0) && (Math.abs(mean) < 0.2*Math.max(-min, max))) mean = 0; // if middle is around 0, use 0

         this.ctrl.projectPos = mean;
      }

      toplevel.traverse(mesh => {
         if (!(mesh instanceof THREE.Mesh) || !mesh.stack) return;

         const geom2 = projectGeometry(mesh.geometry, mesh.parent.absMatrix || mesh.parent.matrixWorld, this.ctrl.project, this.ctrl.projectPos, mesh._flippedMesh);

         if (!geom2) return;

         const mesh2 = new THREE.Mesh(geom2, mesh.material.clone());

         this.#toplevel.add(mesh2);

         mesh2.stack = mesh.stack;
      });

      return true;
   }

   /** @summary Should be invoked when light configuration changed */
   changedLight(box) {
      if (!this.#camera)
         return;

      const need_render = !box;

      if (!box) box = this.getGeomBoundingBox();

      const sizex = box.max.x - box.min.x,
          sizey = box.max.y - box.min.y,
          sizez = box.max.z - box.min.z,
          plights = [], p = (this.ctrl.light.power ?? 1) * 0.5;

      if (this.#camera._lights !== this.ctrl.light.kind) {
         // remove all childs and recreate only necessary lights
         disposeThreejsObject(this.#camera, true);

         this.#camera._lights = this.ctrl.light.kind;

         switch (this.#camera._lights) {
            case 'ambient' : this.#camera.add(new THREE.AmbientLight(0xefefef, p)); break;
            case 'hemisphere' : this.#camera.add(new THREE.HemisphereLight(0xffffbb, 0x080820, p)); break;
            case 'mix': this.#camera.add(new THREE.AmbientLight(0xefefef, p));
            // eslint-disable-next-line  no-fallthrough
            default: // 6 point lights
               for (let n = 0; n < 6; ++n) {
                  const l = new THREE.DirectionalLight(0xefefef, p);
                  this.#camera.add(l);
                  l._id = n;
               }
         }
      }

      for (let k = 0; k < this.#camera.children.length; ++k) {
         const light = this.#camera.children[k];
         let enabled = false;
         if (light.isAmbientLight || light.isHemisphereLight) {
            light.intensity = p;
            continue;
         }
         if (!light.isDirectionalLight) continue;
         switch (light._id) {
            case 0: light.position.set(sizex/5, sizey/5, sizez/5); enabled = this.ctrl.light.specular; break;
            case 1: light.position.set(0, 0, sizez/2); enabled = this.ctrl.light.front; break;
            case 2: light.position.set(0, 2*sizey, 0); enabled = this.ctrl.light.top; break;
            case 3: light.position.set(0, -2*sizey, 0); enabled = this.ctrl.light.bottom; break;
            case 4: light.position.set(-2*sizex, 0, 0); enabled = this.ctrl.light.left; break;
            case 5: light.position.set(2*sizex, 0, 0); enabled = this.ctrl.light.right; break;
         }
         light.power = enabled ? p*Math.PI*4 : 0;
         if (enabled) plights.push(light);
      }

      // keep light power of all sources constant
      plights.forEach(ll => { ll.power = p*4*Math.PI/plights.length; });

      if (need_render) this.render3D();
   }

   /** @summary Returns true if orthographic camera is used */
   isOrthoCamera() {
      return this.ctrl.camera_kind.indexOf('ortho') === 0;
   }

   /** @summary Create configured camera */
   createCamera() {
      if (this.#camera) {
         this.#scene.remove(this.#camera);
         disposeThreejsObject(this.#camera);
         this.#camera = undefined;
      }

      if (this.isOrthoCamera())
         this.#camera = new THREE.OrthographicCamera(-this.#scene_width/2, this.#scene_width/2, this.#scene_height/2, -this.#scene_height/2, 1, 10000);
       else {
         this.#camera = new THREE.PerspectiveCamera(25, this.#scene_width / this.#scene_height, 1, 10000);
         this.#camera.up = this.ctrl._yup ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      }

      // Light - add default directional light, adjust later
      const light = new THREE.DirectionalLight(0xefefef, 0.1);
      light.position.set(10, 10, 10);
      this.#camera.add(light);

      this.#scene.add(this.#camera);
   }

   /** @summary Create special effects */
   createSpecialEffects() {
      if (this.#webgl && this.ctrl.outline && isFunc(this.createOutline)) {
         // code used with jsroot-based geometry drawing in EVE7, not important any longer
         this.#effectComposer = new THREE.EffectComposer(this.#renderer);
         this.#effectComposer.addPass(new THREE.RenderPass(this.#scene, this.#camera));
         this.createOutline(this.#scene, this.#camera, this.#scene_width, this.#scene_height);
      }

      this.ensureBloom();
   }

   /** @summary Return current effect composer */
   getEffectComposer() { return this.#effectComposer; }

   /** @summary Initial scene creation */
   async createScene(w, h, render3d) {
      if (this.#superimpose) {
         const cfg = getHistPainter3DCfg(this.getMainPainter());

         if (cfg?.renderer) {
            this.#scene = cfg.scene;
            this.#scene_width = cfg.scene_width;
            this.#scene_height = cfg.scene_height;
            this.#renderer = cfg.renderer;
            this.#webgl = (this.#renderer.jsroot_render3d === constants.Render3D.WebGL);

            this.#toplevel = new THREE.Object3D();
            this.#scene.add(this.#toplevel);

            if (cfg.scale_x || cfg.scale_y || cfg.scale_z)
               this.#toplevel.scale.set(cfg.scale_x, cfg.scale_y, cfg.scale_z);
            if (cfg.offset_x || cfg.offset_y || cfg.offset_z)
               this.#toplevel.position.set(cfg.offset_x, cfg.offset_y, cfg.offset_z);
            this.#toplevel.updateMatrix();
            this.#toplevel.updateMatrixWorld();

            this.#camera = cfg.camera;
         }

         return this.#renderer?.jsroot_dom;
      }

      return importThreeJs().then(() => {
         // three.js 3D drawing
         this.#scene = new THREE.Scene();
         this.#fog = new THREE.Fog(0xffffff, 1, 10000);
         this.#scene.fog = this.ctrl.use_fog ? this.#fog : null;

         this.#scene.overrideMaterial = new THREE.MeshLambertMaterial({ color: 0x7000ff, vertexColors: false, transparent: true, opacity: 0.2, depthTest: false });

         this.#scene_width = w;
         this.#scene_height = h;

         this.createCamera();

         this.#selected_mesh = null;

         this.#overall_size = 10;

         this.#toplevel = new THREE.Object3D();

         this.#scene.add(this.#toplevel);

         this.#scene.background = new THREE.Color(this.ctrl.background);

         return createRender3D(w, h, render3d, { antialias: true, logarithmicDepthBuffer: false, preserveDrawingBuffer: true });
      }).then(r => {
         this.#renderer = r;

         if (this.batch_format)
            r.jsroot_image_format = this.batch_format;

         this.#webgl = (r.jsroot_render3d === constants.Render3D.WebGL);

         if (isFunc(r.setPixelRatio) && !isNodeJs() && !browser.android)
            r.setPixelRatio(window.devicePixelRatio);
         r.setSize(w, h, !this.#fit_main_area);
         r.localClippingEnabled = true;

         r.setClearColor(this.#scene.background, 1);

         if (this.#fit_main_area && this.#webgl) {
            r.domElement.style.width = '100%';
            r.domElement.style.height = '100%';
            const main = this.selectDom();
            if (main.style('position') === 'static')
               main.style('position', 'relative');
         }

         this.#animating = false;

         this.ctrl.doubleside = false; // both sides need for clipping
         this.createSpecialEffects();

         if (this.#fit_main_area && !this.#webgl) {
            // create top-most SVG for geometry drawings
            const doc = getDocument(),
                  svg = doc.createElementNS(nsSVG, 'svg');
            svg.setAttribute('width', w);
            svg.setAttribute('height', h);
            svg.appendChild(this.#renderer.jsroot_dom);
            return svg;
         }

         return this.#renderer.jsroot_dom;
      });
   }

   /** @summary Start geometry drawing */
   startDrawGeometry(force) {
      if (!force && !this.isStage(stageInit)) {
         this.#draw_nodes_again = true;
         return;
      }

      if (this.#clones_owner)
         this.#clones?.setDefaultColors(this.ctrl.dflt_colors);

      this.#last_render_tm = this.#start_render_tm = new Date().getTime();
      this.#last_render_meshes = 0;
      this.changeStage(stageCollect);
      this.#drawing_ready = false;
      this.ctrl.info.num_meshes = 0;
      this.ctrl.info.num_faces = 0;
      this.ctrl.info.num_shapes = 0;
      this.#selected_mesh = null;

      if (this.ctrl.project) {
         if (this.#clones_owner) {
            if (this.#fullgeom_proj)
               this.changeStage(stageBuildProj);
            else
               this.#fullgeom_proj = new THREE.Object3D();
         } else
            this.changeStage(stageWaitMain);
      }

      this.#last_manifest = undefined;
      this.#last_hidden = undefined; // clear list of hidden objects

      this.#draw_nodes_again = undefined; // forget about such flag

      this.continueDraw();
   }

   /** @summary reset all kind of advanced features like depth test */
   resetAdvanced() {
      this.ctrl.depthTest = true;
      this.ctrl.clipIntersect = true;
      this.ctrl.depthMethod = 'ray';

      this.changedDepthMethod('norender');
      this.changedDepthTest();
   }

   /** @summary returns maximal dimension */
   getOverallSize(force) {
      if (!this.#overall_size || force || this.#custom_bounding_box) {
         const box = this.getGeomBoundingBox();

         // if detect of coordinates fails - ignore
         if (!Number.isFinite(box.min.x)) return 1000;

         this.#overall_size = 2 * Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
      }

      return this.#overall_size;
   }

   /** @summary Create png image with drawing snapshot. */
   createSnapshot(filename) {
      if (!this.#renderer) return;
      this.render3D(0);
      const dataUrl = this.#renderer.domElement.toDataURL('image/png');
      if (filename === 'asis') return dataUrl;
      dataUrl.replace('image/png', 'image/octet-stream');
      const doc = getDocument(),
            link = doc.createElement('a');
      if (isStr(link.download)) {
         doc.body.appendChild(link); // Firefox requires the link to be in the body
         link.download = filename || 'geometry.png';
         link.href = dataUrl;
         link.click();
         doc.body.removeChild(link); // remove the link when done
      }
   }

   /** @summary Returns url parameters defining camera position.
     * @desc Either absolute position are provided (arg === true) or zoom, roty, rotz parameters */
   produceCameraUrl(arg) {
      if (!this.#camera)
         return '';

      if (this.#camera.isOrthographicCamera) {
         const zoom = Math.round(this.#camera.zoom * 100);
         return this.ctrl.camera_kind + (zoom === 100 ? '' : `,zoom=${zoom}`);
      }

      let kind = '';
      if (this.ctrl.camera_kind !== 'perspective')
        kind = this.ctrl.camera_kind + ',';

      if (arg === true) {
         const p = this.#camera.position, t = this.#controls?.target;
         if (!p || !t) return '';

         const conv = v => {
            let s = '';
            if (v < 0) { s = 'n'; v = -v; }
            return s + v.toFixed(0);
         };

         let res = `${kind}camx${conv(p.x)},camy${conv(p.y)},camz${conv(p.z)}`;
         if (t.x || t.y || t.z) res += `,camlx${conv(t.x)},camly${conv(t.y)},camlz${conv(t.z)}`;
         return res;
      }

      if (!this.#lookat || !this.#camera0pos)
         return '';

      const pos1 = new THREE.Vector3().add(this.#camera0pos).sub(this.#lookat),
            pos2 = new THREE.Vector3().add(this.#camera.position).sub(this.#lookat),
            zoom = Math.min(10000, Math.max(1, this.ctrl.zoom * pos2.length() / pos1.length() * 100));

      pos1.normalize();
      pos2.normalize();

      const quat = new THREE.Quaternion(), euler = new THREE.Euler();

      quat.setFromUnitVectors(pos1, pos2);
      euler.setFromQuaternion(quat, 'YZX');

      let roty = euler.y / Math.PI * 180,
          rotz = euler.z / Math.PI * 180;

      if (roty < 0) roty += 360;
      if (rotz < 0) rotz += 360;
      return `${kind}roty${roty.toFixed(0)},rotz${rotz.toFixed(0)},zoom${zoom.toFixed(0)}`;
   }

   /** @summary Calculates current zoom factor */
   calculateZoom() {
      if (this.#camera0pos && this.#camera && this.#lookat) {
         const pos1 = new THREE.Vector3().add(this.#camera0pos).sub(this.#lookat),
               pos2 = new THREE.Vector3().add(this.#camera.position).sub(this.#lookat);
         return pos2.length() / pos1.length();
      }

      return 0;
   }

   /** @summary Place camera to default position,
     * @param arg - true forces camera readjustment, 'first' is called when suppose to be first after complete drawing
     * @param keep_zoom - tries to keep zooming factor of the camera */
   adjustCameraPosition(arg, keep_zoom) {
      if (!this.#toplevel || this.#superimpose)
         return;

      const force = (arg === true),
            first_time = (arg === 'first') || force,
            only_set = (arg === 'only_set'),
            box = this.getGeomBoundingBox();

      // let box2 = new THREE.Box3().makeEmpty();
      // box2.expandByObject(this.#toplevel, true);
      // console.log('min,max', box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z );

      // if detect of coordinates fails - ignore
      if (!Number.isFinite(box.min.x)) {
         console.log('FAILS to get geometry bounding box');
         return;
      }

      const sizex = box.max.x - box.min.x,
            sizey = box.max.y - box.min.y,
            sizez = box.max.z - box.min.z,
            midx = (box.max.x + box.min.x)/2,
            midy = (box.max.y + box.min.y)/2,
            midz = (box.max.z + box.min.z)/2,
            more = this.ctrl._axis || (this.ctrl.camera_overlay === 'bar') ? 0.2 : 0.1;

      if (this.#scene_size && !force) {
         function test(v1, v2, scale) {
            if (!scale) scale = Math.abs((v1+v2)/2);
            return scale <= 1e-20 ? true : Math.abs(v2-v1)/scale > 0.01;
         };
         const d = this.#scene_size;
         if (!test(sizex, d.sizex) && !test(sizey, d.sizey) && !test(sizez, d.sizez) &&
             !test(midx, d.midx, d.sizex) && !test(midy, d.midy, d.sizey) && !test(midz, d.midz, d.sizez)) {
               if (this.ctrl.select_in_view)
                  this.startDrawGeometry();
               return;
         }
      }

      this.#scene_size = { sizex, sizey, sizez, midx, midy, midz };

      this.#overall_size = 2 * Math.max(sizex, sizey, sizez);

      this.#camera.near = this.#overall_size / 350;
      this.#camera.far = this.#overall_size * 100;
      this.#fog.near = this.#overall_size * 0.5;
      this.#fog.far = this.#overall_size * 5;

      if (first_time) {
         for (let naxis = 0; naxis < 3; ++naxis) {
            const cc = this.ctrl.clip[naxis];
            cc.min = box.min[cc.name];
            cc.max = box.max[cc.name];
            const sz = cc.max - cc.min;
            cc.max += sz*0.01;
            cc.min -= sz*0.01;
            if (sz > 100)
               cc.step = 0.1;
            else if (sz > 1)
               cc.step = 0.001;
            else
               cc.step = undefined;

            if (!cc.value)
               cc.value = (cc.min + cc.max) / 2;
            else if (cc.value < cc.min)
               cc.value = cc.min;
            else if (cc.value > cc.max)
               cc.value = cc.max;
         }
      }

      let k = 2*this.ctrl.zoom;
      const max_all = Math.max(sizex, sizey, sizez),
            sign = this.ctrl.camera_kind.indexOf('N') > 0 ? -1 : 1;

      this.#lookat = new THREE.Vector3(midx, midy, midz);
      this.#camera0pos = new THREE.Vector3(-2*max_all, 0, 0); // virtual 0 position, where rotation starts

      this.#camera.updateMatrixWorld();
      this.#camera.updateProjectionMatrix();

      if ((this.ctrl.rotatey || this.ctrl.rotatez) && this.ctrl.can_rotate) {
         const prev_zoom = this.calculateZoom();
         if (keep_zoom && prev_zoom) k = 2*prev_zoom;

         const euler = new THREE.Euler(0, this.ctrl.rotatey/180*Math.PI, this.ctrl.rotatez/180*Math.PI, 'YZX');

         this.#camera.position.set(-k*max_all, 0, 0);
         this.#camera.position.applyEuler(euler);
         this.#camera.position.add(new THREE.Vector3(midx, midy, midz));

         if (keep_zoom && prev_zoom) {
            const actual_zoom = this.calculateZoom();
            k *= prev_zoom/actual_zoom;

            this.#camera.position.set(-k*max_all, 0, 0);
            this.#camera.position.applyEuler(euler);
            this.#camera.position.add(new THREE.Vector3(midx, midy, midz));
         }
      } else if (this.ctrl.camx !== undefined && this.ctrl.camy !== undefined && this.ctrl.camz !== undefined) {
         this.#camera.position.set(this.ctrl.camx, this.ctrl.camy, this.ctrl.camz);
         this.#lookat.set(this.ctrl.camlx || 0, this.ctrl.camly || 0, this.ctrl.camlz || 0);
         this.ctrl.camx = this.ctrl.camy = this.ctrl.camz = this.ctrl.camlx = this.ctrl.camly = this.ctrl.camlz = undefined;
      } else if ((this.ctrl.camera_kind === 'orthoXOY') || (this.ctrl.camera_kind === 'orthoXNOY')) {
         this.#camera.up.set(0, 1, 0);
         this.#camera.position.set(sign < 0 ? midx*2 : 0, 0, midz + sign*sizez*2);
         this.#lookat.set(sign < 0 ? midx*2 : 0, 0, midz);
         this.#camera.left = box.min.x - more*sizex;
         this.#camera.right = box.max.x + more*sizex;
         this.#camera.top = box.max.y + more*sizey;
         this.#camera.bottom = box.min.y - more*sizey;
         if (!keep_zoom) this.#camera.zoom = this.ctrl.zoom || 1;
         this.#camera.orthoSign = sign;
         this.#camera.orthoZ = [midz, sizez/2];
      } else if ((this.ctrl.camera_kind === 'orthoXOZ') || (this.ctrl.camera_kind === 'orthoXNOZ')) {
         this.#camera.up.set(0, 0, 1);
         this.#camera.position.set(sign < 0 ? midx*2 : 0, midy - sign*sizey*2, 0);
         this.#lookat.set(sign < 0 ? midx*2 : 0, midy, 0);
         this.#camera.left = box.min.x - more*sizex;
         this.#camera.right = box.max.x + more*sizex;
         this.#camera.top = box.max.z + more*sizez;
         this.#camera.bottom = box.min.z - more*sizez;
         if (!keep_zoom) this.#camera.zoom = this.ctrl.zoom || 1;
         this.#camera.orthoIndicies = [0, 2, 1];
         this.#camera.orthoRotation = geom => geom.rotateX(Math.PI/2);
         this.#camera.orthoSign = sign;
         this.#camera.orthoZ = [midy, -sizey/2];
      } else if ((this.ctrl.camera_kind === 'orthoZOY') || (this.ctrl.camera_kind === 'orthoZNOY')) {
         this.#camera.up.set(0, 1, 0);
         this.#camera.position.set(midx - sign*sizex*2, 0, sign < 0 ? midz*2 : 0);
         this.#lookat.set(midx, 0, sign < 0 ? midz*2 : 0);
         this.#camera.left = box.min.z - more*sizez;
         this.#camera.right = box.max.z + more*sizez;
         this.#camera.top = box.max.y + more*sizey;
         this.#camera.bottom = box.min.y - more*sizey;
         if (!keep_zoom) this.#camera.zoom = this.ctrl.zoom || 1;
         this.#camera.orthoIndicies = [2, 1, 0];
         this.#camera.orthoRotation = geom => geom.rotateY(-Math.PI/2);
         this.#camera.orthoSign = sign;
         this.#camera.orthoZ = [midx, -sizex/2];
      } else if ((this.ctrl.camera_kind === 'orthoZOX') || (this.ctrl.camera_kind === 'orthoZNOX')) {
         this.#camera.up.set(1, 0, 0);
         this.#camera.position.set(0, midy - sign*sizey*2, sign > 0 ? midz*2 : 0);
         this.#lookat.set(0, midy, sign > 0 ? midz*2 : 0);
         this.#camera.left = box.min.z - more*sizez;
         this.#camera.right = box.max.z + more*sizez;
         this.#camera.top = box.max.x + more*sizex;
         this.#camera.bottom = box.min.x - more*sizex;
         if (!keep_zoom) this.#camera.zoom = this.ctrl.zoom || 1;
         this.#camera.orthoIndicies = [2, 0, 1];
         this.#camera.orthoRotation = geom => geom.rotateX(Math.PI/2).rotateY(Math.PI/2);
         this.#camera.orthoSign = sign;
         this.#camera.orthoZ = [midy, -sizey/2];
      } else if (this.ctrl.project) {
         switch (this.ctrl.project) {
            case 'x': this.#camera.position.set(k*1.5*Math.max(sizey, sizez), 0, 0); break;
            case 'y': this.#camera.position.set(0, k*1.5*Math.max(sizex, sizez), 0); break;
            case 'z': this.#camera.position.set(0, 0, k*1.5*Math.max(sizex, sizey)); break;
         }
      } else if (this.ctrl.camera_kind === 'perspXOZ') {
         this.#camera.up.set(0, 1, 0);
         this.#camera.position.set(midx - 3*max_all, midy, midz);
      } else if (this.ctrl.camera_kind === 'perspYOZ') {
         this.#camera.up.set(1, 0, 0);
         this.#camera.position.set(midx, midy - 3*max_all, midz);
      } else if (this.ctrl.camera_kind === 'perspXOY') {
         this.#camera.up.set(0, 0, 1);
         this.#camera.position.set(midx - 3*max_all, midy, midz);
      } else if (this.ctrl._yup) {
         this.#camera.up.set(0, 1, 0);
         this.#camera.position.set(midx-k*Math.max(sizex, sizez), midy+k*sizey, midz-k*Math.max(sizex, sizez));
      } else {
         this.#camera.up.set(0, 0, 1);
         this.#camera.position.set(midx-k*Math.max(sizex, sizey), midy-k*Math.max(sizex, sizey), midz+k*sizez);
      }

      if (this.#camera.isOrthographicCamera && this.isOrthoCamera() && this.#scene_width && this.#scene_height) {
         const screen_ratio = this.#scene_width / this.#scene_height,
               szx = this.#camera.right - this.#camera.left, szy = this.#camera.top - this.#camera.bottom;

         if (screen_ratio > szx / szy) {
            // screen wider than actual geometry
            const m = (this.#camera.right + this.#camera.left) / 2;
            this.#camera.left = m - szy * screen_ratio / 2;
            this.#camera.right = m + szy * screen_ratio / 2;
         } else {
            // screen higher than actual geometry
            const m = (this.#camera.top + this.#camera.bottom) / 2;
            this.#camera.top = m + szx / screen_ratio / 2;
            this.#camera.bottom = m - szx / screen_ratio / 2;
         }
      }

      this.#camera.lookAt(this.#lookat);
      this.#camera.updateProjectionMatrix();

      this.changedLight(box);

      if (this.#controls) {
         this.#controls.target.copy(this.#lookat);
         if (!only_set) this.#controls.update();
      }

      // recheck which elements to draw
      if (this.ctrl.select_in_view && !only_set)
         this.startDrawGeometry();
   }

   /** @summary Specifies camera position as rotation around geometry center */
   setCameraPosition(rotatey, rotatez, zoom) {
      if (!this.ctrl) return;
      this.ctrl.rotatey = rotatey || 0;
      this.ctrl.rotatez = rotatez || 0;
      let preserve_zoom = false;
      if (zoom && Number.isFinite(zoom))
         this.ctrl.zoom = zoom;
       else
         preserve_zoom = true;

      this.adjustCameraPosition(false, preserve_zoom);
   }

   /** @summary Specifies camera position and point to which it looks to
       @desc Both specified in absolute coordinates */
   setCameraPositionAndLook(camx, camy, camz, lookx, looky, lookz) {
      if (!this.ctrl)
         return;
      this.ctrl.camx = camx;
      this.ctrl.camy = camy;
      this.ctrl.camz = camz;
      this.ctrl.camlx = lookx;
      this.ctrl.camly = looky;
      this.ctrl.camlz = lookz;
      this.adjustCameraPosition(false);
   }

   /** @summary focus on item */
   focusOnItem(itemname) {
      if (!itemname || !this.#clones)
         return;

      const stack = this.#clones.findStackByName(itemname);

      if (stack)
         this.focusCamera(this.#clones.resolveStack(stack, true), false);
   }

   /** @summary focus camera on specified position */
   focusCamera(focus, autoClip) {
      if (this.ctrl.project || this.isOrthoCamera()) {
         this.adjustCameraPosition(true);
         return this.render3D();
      }

      let box = new THREE.Box3();
      if (focus === undefined)
         box = this.getGeomBoundingBox();
       else if (focus instanceof THREE.Mesh)
         box.setFromObject(focus);
       else {
         const center = new THREE.Vector3().setFromMatrixPosition(focus.matrix),
             node = focus.node,
             halfDelta = new THREE.Vector3(node.fDX, node.fDY, node.fDZ).multiplyScalar(0.5);
         box.min = center.clone().sub(halfDelta);
         box.max = center.clone().add(halfDelta);
      }

      const sizex = box.max.x - box.min.x,
          sizey = box.max.y - box.min.y,
          sizez = box.max.z - box.min.z,
          midx = (box.max.x + box.min.x)/2,
          midy = (box.max.y + box.min.y)/2,
          midz = (box.max.z + box.min.z)/2;

      let position, frames = 50, step = 0;
      if (this.ctrl._yup)
         position = new THREE.Vector3(midx-2*Math.max(sizex, sizez), midy+2*sizey, midz-2*Math.max(sizex, sizez));
      else
         position = new THREE.Vector3(midx-2*Math.max(sizex, sizey), midy-2*Math.max(sizex, sizey), midz+2*sizez);

      const target = new THREE.Vector3(midx, midy, midz),
            oldTarget = this.#controls.target,
            // Amount to change camera position at each step
            posIncrement = position.sub(this.#camera.position).divideScalar(frames),
            // Amount to change 'lookAt' so it will end pointed at target
            targetIncrement = target.sub(oldTarget).divideScalar(frames);

      autoClip = autoClip && this.#webgl;

      // Automatic Clipping
      if (autoClip) {
         for (let axis = 0; axis < 3; ++axis) {
            const cc = this.ctrl.clip[axis];
            if (!cc.enabled) { cc.value = cc.min; cc.enabled = true; }
            cc.inc = ((cc.min + cc.max) / 2 - cc.value) / frames;
         }
         this.updateClipping();
      }

      this.#animating = true;

      const animate = () => {
         if (this.#animating === undefined)
            return;

         if (this.#animating)
            requestAnimationFrame(animate);
          else if (!this.#geom_viewer)
            this.startDrawGeometry();
         const smoothFactor = -Math.cos((2.0*Math.PI*step)/frames) + 1.0;
         this.#camera.position.add(posIncrement.clone().multiplyScalar(smoothFactor));
         oldTarget.add(targetIncrement.clone().multiplyScalar(smoothFactor));
         this.#lookat = oldTarget;
         this.#camera.lookAt(this.#lookat);
         this.#camera.updateProjectionMatrix();

         const tm1 = new Date().getTime();
         if (autoClip) {
            for (let axis = 0; axis < 3; ++axis)
               this.ctrl.clip[axis].value += this.ctrl.clip[axis].inc * smoothFactor;
            this.updateClipping();
         } else
            this.render3D(0);

         const tm2 = new Date().getTime();
         if ((step === 0) && (tm2-tm1 > 200)) frames = 20;
         step++;
         this.#animating = step < frames;
      };

      animate();

   //   this.#controls.update();
   }

   /** @summary activate auto rotate */
   autorotate(speed) {
      const rotSpeed = (speed === undefined) ? 2.0 : speed;
      let last = new Date();

      const animate = () => {
         if (!this.#renderer || !this.ctrl) return;

         const current = new Date();

         if (this.ctrl.rotate)
            requestAnimationFrame(animate);

         if (this.#controls) {
            this.#controls.autoRotate = this.ctrl.rotate;
            this.#controls.autoRotateSpeed = rotSpeed * (current.getTime() - last.getTime()) / 16.6666;
            this.#controls.update();
         }
         last = new Date();
         this.render3D(0);
      };

      if (this.#webgl) animate();
   }

   /** @summary called at the end of scene drawing */
   completeScene() {
   }

   /** @summary Drawing with 'count' option
     * @desc Scans hierarchy and check for unique nodes
     * @return {Promise} with object drawing ready */
   async drawCount(unqievis, clonetm) {
      const makeTime = tm => (this.isBatchMode() ? 'anytime' : tm.toString()) + ' ms',

       res = ['Unique nodes: ' + this.#clones.nodes.length,
                  'Unique visible: ' + unqievis,
                  'Time to clone: ' + makeTime(clonetm)];

      // need to fill cached value line numvischld
      this.#clones.scanVisible();

      let nshapes = 0;
      const arg = {
         clones: this.#clones,
         cnt: [],
         func(node) {
            if (this.cnt[this.last] === undefined)
               this.cnt[this.last] = 1;
            else
               this.cnt[this.last]++;

            nshapes += countNumShapes(this.clones.getNodeShape(node.id));
            return true;
         }
      };

      let tm1 = new Date().getTime(),
          numvis = this.#clones.scanVisible(arg),
          tm2 = new Date().getTime();

      res.push(`Total visible nodes: ${numvis}`, `Total shapes: ${nshapes}`);

      for (let lvl = 0; lvl < arg.cnt.length; ++lvl) {
         if (arg.cnt[lvl] !== undefined)
            res.push(`  lvl${lvl}: ${arg.cnt[lvl]}`);
      }

      res.push(`Time to scan: ${makeTime(tm2-tm1)}`, '', 'Check timing for matrix calculations ...');

      const elem = this.selectDom().style('overflow', 'auto');

      if (this.isBatchMode())
         elem.property('_json_object_', res);
      else
         res.forEach(str => elem.append('p').text(str));

      return postponePromise(() => {
         arg.domatrix = true;
         tm1 = new Date().getTime();
         numvis = this.#clones.scanVisible(arg);
         tm2 = new Date().getTime();

         const last_str = `Time to scan with matrix: ${makeTime(tm2-tm1)}`;
         if (this.isBatchMode())
            res.push(last_str);
         else
            elem.append('p').text(last_str);
         return this;
      }, 100);
   }

   /** @summary Handle drop operation
     * @desc opt parameter can include function name like opt$func_name
     * Such function should be possible to find via {@link findFunction}
     * Function has to return Promise with objects to draw on geometry
     * By default function with name 'extract_geo_tracks' is checked
     * @return {Promise} handling of drop operation */
   async performDrop(obj, itemname, hitem, opt) {
      if (obj?.$kind === 'TTree') {
         // drop tree means function call which must extract tracks from provided tree

         let funcname = 'extract_geo_tracks';

         if (opt && opt.indexOf('$') > 0) {
            funcname = opt.slice(0, opt.indexOf('$'));
            opt = opt.slice(opt.indexOf('$')+1);
         }

         const func = findFunction(funcname);

         if (!func) return Promise.reject(Error(`Function ${funcname} not found`));

         return func(obj, opt).then(tracks => {
            if (!tracks) return this;

            // FIXME: probably tracks should be remembered?
            return this.drawExtras(tracks, '', false).then(() => {
               this.updateClipping(true);
               return this.render3D(100);
            });
         });
      }

      return this.drawExtras(obj, itemname).then(is_any => {
         if (!is_any) return this;

         if (hitem) hitem._painter = this; // set for the browser item back pointer

         return this.render3D(100);
      });
   }

   /** @summary function called when mouse is going over the item in the browser */
   mouseOverHierarchy(on, itemname, hitem) {
      if (!this.ctrl)
         return; // protection for cleaned-up painter

      const obj = hitem._obj;

      // let's highlight tracks and hits only for the time being
      if (!obj || (obj._typename !== clTEveTrack && obj._typename !== clTEvePointSet && obj._typename !== clTPolyMarker3D)) return;

      this.highlightMesh(null, 0x00ff00, on ? obj : null);
   }

   /** @summary clear extra drawn objects like tracks or hits */
   clearExtras() {
      this.getExtrasContainer('delete');
      this.#extra_objects = undefined; // workaround, later will be normal function
      this.render3D();
   }

   /** @summary Register extra objects like tracks or hits
    * @desc Rendered after main geometry volumes are created
    * Check if object already exists to prevent duplication */
   addExtra(obj, itemname) {
      if (!this.#extra_objects)
         this.#extra_objects = create(clTList);

      if (this.#extra_objects.arr.indexOf(obj) >= 0)
         return false;

      this.#extra_objects.Add(obj, itemname);

      delete obj.$hidden_via_menu; // remove previous hidden property

      return true;
   }

   /** @summary manipulate visibility of extra objects, used for HierarchyPainter
     * @private */
   extraObjectVisible(hpainter, hitem, toggle) {
      if (!this.#extra_objects)
         return;

      const itemname = hpainter.itemFullName(hitem);
      let indx = this.#extra_objects.opt.indexOf(itemname);

      if ((indx < 0) && hitem._obj) {
         indx = this.#extra_objects.arr.indexOf(hitem._obj);
         // workaround - if object found, replace its name
         if (indx >= 0) this.#extra_objects.opt[indx] = itemname;
      }

      if (indx < 0)
         return;

      const obj = this.#extra_objects.arr[indx];
      let res = Boolean(obj.$hidden_via_menu);

      if (toggle) {
         obj.$hidden_via_menu = res;
         res = !res;

         let mesh = null;
         // either found painted object or just draw once again
         this.#toplevel.traverse(node => { if (node.geo_object === obj) mesh = node; });

         if (mesh) {
            mesh.visible = res;
            this.render3D();
         } else if (res) {
            this.drawExtras(obj, '', false).then(() => {
               this.updateClipping(true);
               this.render3D();
            });
         }
      }

      return res;
   }

   /** @summary Draw extra object like tracks
     * @return {Promise} for ready */
   async drawExtras(obj, itemname, add_objects, not_wait_render) {
      // if object was hidden via menu, do not redraw it with next draw call
      if (!obj?._typename || (!add_objects && obj.$hidden_via_menu))
         return false;

      let do_render = false;
      if (add_objects === undefined) {
         add_objects = true;
         do_render = true;
      } else if (not_wait_render)
         do_render = true;


      let promise = false;

      if ((obj._typename === clTList) || (obj._typename === clTObjArray)) {
         if (!obj.arr) return false;
         const parr = [];
         for (let n = 0; n < obj.arr.length; ++n) {
            const sobj = obj.arr[n];
            let sname = obj.opt ? obj.opt[n] : '';
            if (!sname) sname = (itemname || '<prnt>') + `/[${n}]`;
            parr.push(this.drawExtras(sobj, sname, add_objects));
         }
         promise = Promise.all(parr).then(ress => ress.indexOf(true) >= 0);
      } else if (obj._typename === 'Mesh') {
         // adding mesh as is
         this.addToExtrasContainer(obj);
         promise = Promise.resolve(true);
      } else if (obj._typename === 'TGeoTrack') {
         if (!add_objects || this.addExtra(obj, itemname))
            promise = this.drawGeoTrack(obj, itemname);
      } else if (obj._typename === clTPolyLine3D) {
         if (!add_objects || this.addExtra(obj, itemname))
            promise = this.drawPolyLine(obj, itemname);
      } else if ((obj._typename === clTEveTrack) || (obj._typename === `${nsREX}REveTrack`)) {
         if (!add_objects || this.addExtra(obj, itemname))
            promise = this.drawEveTrack(obj, itemname);
      } else if ((obj._typename === clTEvePointSet) || (obj._typename === `${nsREX}REvePointSet`) || (obj._typename === clTPolyMarker3D)) {
         if (!add_objects || this.addExtra(obj, itemname))
            promise = this.drawHit(obj, itemname);
      } else if ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract)) {
         if (!add_objects || this.addExtra(obj, itemname))
            promise = this.drawExtraShape(obj, itemname);
      }

      return getPromise(promise).then(is_any => {
         if (!is_any || !do_render)
            return is_any;

         this.updateClipping(true);

         const pr = this.render3D(100, not_wait_render ? 'nopromise' : false);

         return not_wait_render ? this : pr;
      });
   }

   /** @summary returns container for extra objects */
   getExtrasContainer(action, name) {
      if (!this.#toplevel) return null;

      if (!name) name = 'tracks';

      let extras = null;
      const lst = [];
      for (let n = 0; n < this.#toplevel.children.length; ++n) {
         const chld = this.#toplevel.children[n];
         if (!chld._extras) continue;
         if (action === 'collect') { lst.push(chld); continue; }
         if (chld._extras === name) { extras = chld; break; }
      }

      if (action === 'collect') {
         for (let k = 0; k < lst.length; ++k)
            this.#toplevel.remove(lst[k]);
         return lst;
      }

      if (action === 'delete') {
         if (extras) this.#toplevel.remove(extras);
         disposeThreejsObject(extras);
         return null;
      }

      if ((action !== 'get') && !extras) {
         extras = new THREE.Object3D();
         extras._extras = name;
         this.#toplevel.add(extras);
      }

      return extras;
   }

   /** @summary add object to extras container.
     * @desc If fail, dispose object */
   addToExtrasContainer(obj, name) {
      const container = this.getExtrasContainer('', name);
      if (container)
         container.add(obj);
       else {
         console.warn('Fail to add object to extras');
         disposeThreejsObject(obj);
      }
   }

   /** @summary drawing TGeoTrack */
   drawGeoTrack(track, itemname) {
      if (!track?.fNpoints) return false;

      const linewidth = browser.isWin ? 1 : (track.fLineWidth || 1), // line width not supported on windows
            color = getColor(track.fLineColor) || '#ff00ff',
            npoints = Math.round(track.fNpoints/4), // each track point has [x,y,z,t] coordinate
            buf = new Float32Array((npoints-1)*6),
            projv = this.ctrl.projectPos,
            projx = (this.ctrl.project === 'x'),
            projy = (this.ctrl.project === 'y'),
            projz = (this.ctrl.project === 'z');

      for (let k = 0, pos = 0; k < npoints-1; ++k, pos+=6) {
         buf[pos] = projx ? projv : track.fPoints[k*4];
         buf[pos+1] = projy ? projv : track.fPoints[k*4+1];
         buf[pos+2] = projz ? projv : track.fPoints[k*4+2];
         buf[pos+3] = projx ? projv : track.fPoints[k*4+4];
         buf[pos+4] = projy ? projv : track.fPoints[k*4+5];
         buf[pos+5] = projz ? projv : track.fPoints[k*4+6];
      }

      const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth }),
            line = createLineSegments(buf, lineMaterial);

      line.defaultOrder = line.renderOrder = 1000000; // to bring line to the front
      line.geo_name = itemname;
      line.geo_object = track;
      line.hightlightWidthScale = 2;

      if (itemname?.indexOf('<prnt>/Tracks') === 0)
         line.main_track = true;

      this.addToExtrasContainer(line);

      return true;
   }

   /** @summary drawing TPolyLine3D */
   drawPolyLine(line, itemname) {
      if (!line) return false;

      const linewidth = browser.isWin ? 1 : (line.fLineWidth || 1),
            color = getColor(line.fLineColor) || '#ff00ff',
            npoints = line.fN,
            fP = line.fP,
            buf = new Float32Array((npoints-1)*6),
            projv = this.ctrl.projectPos,
            projx = (this.ctrl.project === 'x'),
            projy = (this.ctrl.project === 'y'),
            projz = (this.ctrl.project === 'z');

      for (let k = 0, pos = 0; k < npoints-1; ++k, pos += 6) {
         buf[pos] = projx ? projv : fP[k*3];
         buf[pos+1] = projy ? projv : fP[k*3+1];
         buf[pos+2] = projz ? projv : fP[k*3+2];
         buf[pos+3] = projx ? projv : fP[k*3+3];
         buf[pos+4] = projy ? projv : fP[k*3+4];
         buf[pos+5] = projz ? projv : fP[k*3+5];
      }

      const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth }),
            line3d = createLineSegments(buf, lineMaterial);

      line3d.defaultOrder = line3d.renderOrder = 1000000; // to bring line to the front
      line3d.geo_name = itemname;
      line3d.geo_object = line;
      line3d.hightlightWidthScale = 2;

      this.addToExtrasContainer(line3d);

      return true;
   }

   /** @summary Drawing TEveTrack */
   drawEveTrack(track, itemname) {
      if (!track || (track.fN <= 0)) return false;

      const linewidth = browser.isWin ? 1 : (track.fLineWidth || 1),
            color = getColor(track.fLineColor) || '#ff00ff',
            buf = new Float32Array((track.fN-1)*6),
            projv = this.ctrl.projectPos,
            projx = (this.ctrl.project === 'x'),
            projy = (this.ctrl.project === 'y'),
            projz = (this.ctrl.project === 'z');

      for (let k = 0, pos = 0; k < track.fN-1; ++k, pos+=6) {
         buf[pos] = projx ? projv : track.fP[k*3];
         buf[pos+1] = projy ? projv : track.fP[k*3+1];
         buf[pos+2] = projz ? projv : track.fP[k*3+2];
         buf[pos+3] = projx ? projv : track.fP[k*3+3];
         buf[pos+4] = projy ? projv : track.fP[k*3+4];
         buf[pos+5] = projz ? projv : track.fP[k*3+5];
      }

      const lineMaterial = new THREE.LineBasicMaterial({ color, linewidth }),
            line = createLineSegments(buf, lineMaterial);

      line.defaultOrder = line.renderOrder = 1000000; // to bring line to the front
      line.geo_name = itemname;
      line.geo_object = track;
      line.hightlightWidthScale = 2;

      this.addToExtrasContainer(line);

      return true;
   }

   /** @summary Drawing different hits types like TPolyMarker3D */
   async drawHit(hit, itemname) {
      if (!hit || !hit.fN || (hit.fN < 0))
         return false;

      // make hit size scaling factor of overall geometry size
      // otherwise it is not possible to correctly see hits at all
      const nhits = hit.fN,
            projv = this.ctrl.projectPos,
            projx = (this.ctrl.project === 'x'),
            projy = (this.ctrl.project === 'y'),
            projz = (this.ctrl.project === 'z'),
            hit_scale = Math.max(hit.fMarkerSize * this.getOverallSize() * (this.getOptions().dummy ? 0.015 : 0.005), 0.2),
            pnts = new PointsCreator(nhits, this.#webgl, hit_scale);

      for (let i = 0; i < nhits; i++) {
         pnts.addPoint(projx ? projv : hit.fP[i*3],
                       projy ? projv : hit.fP[i*3+1],
                       projz ? projv : hit.fP[i*3+2]);
      }

      return pnts.createPoints({ color: getColor(hit.fMarkerColor) || '#0000ff', style: hit.fMarkerStyle }).then(mesh => {
         mesh.defaultOrder = mesh.renderOrder = 1000000; // to bring points to the front
         mesh.highlightScale = 2;
         mesh.geo_name = itemname;
         mesh.geo_object = hit;
         this.addToExtrasContainer(mesh);
         return true; // indicate that rendering should be done
      });
   }

   /** @summary Draw extra shape on the geometry */
   drawExtraShape(obj, itemname) {
      // eslint-disable-next-line no-use-before-define
      const mesh = build(obj);
      if (!mesh) return false;

      mesh.geo_name = itemname;
      mesh.geo_object = obj;

      this.addToExtrasContainer(mesh);
      return true;
   }

   /** @summary Search for specified node
     * @private */
   findNodeWithVolume(name, action, prnt, itemname, volumes) {
      let first_level = false, res = null;

      if (!prnt) {
         prnt = this.getGeometry();
         if (!prnt && (getNodeKind(prnt) !== kindGeo))
            return null;
         itemname = this.#geo_manager ? prnt.fName : '';
         first_level = true;
         volumes = [];
      } else {
         if (itemname) itemname += '/';
         itemname += prnt.fName;
      }

      if (!prnt.fVolume || prnt.fVolume._searched) return null;

      if (name.test(prnt.fVolume.fName)) {
         res = action({ node: prnt, item: itemname });
         if (res) return res;
      }

      prnt.fVolume._searched = true;
      volumes.push(prnt.fVolume);

      if (prnt.fVolume.fNodes) {
         for (let n = 0, len = prnt.fVolume.fNodes.arr.length; n < len; ++n) {
            res = this.findNodeWithVolume(name, action, prnt.fVolume.fNodes.arr[n], itemname, volumes);
            if (res) break;
         }
      }

      if (first_level) {
         for (let n = 0, len = volumes.length; n < len; ++n)
            delete volumes[n]._searched;
      }

      return res;
   }

   /** @summary Search for created shape for nodeid
    * @desc Used in ROOT geometry painter */
   findNodeShape(nodeid) {
      if ((nodeid !== undefined) && !this.#draw_nodes) {
         for (let k = 0; k < this.#draw_nodes.length; ++k) {
            const item = this.geo_painter._draw_nodes[k];
            if ((item.nodeid === nodeid) && item.server_shape)
               return item.server_shape;
         }
      }
   }

   /** @summary Process script option - load and execute some gGeoManager-related calls */
   async loadMacro(script_name) {
      const result = { obj: this.getGeometry(), prefix: '' };

      if (this.#geo_manager)
         result.prefix = result.obj.fName;

      if (!script_name || (script_name.length < 3) || (getNodeKind(result.obj) !== kindGeo))
         return result;

      const mgr = {
            GetVolume: name => {
               const regexp = new RegExp('^'+name+'$'),
                   currnode = this.findNodeWithVolume(regexp, arg => arg);

               if (!currnode) console.log(`Did not found ${name} volume`);

               // return proxy object with several methods, typically used in ROOT geom scripts
               return {
                   found: currnode,
                   fVolume: currnode?.node?.fVolume,
                   InvisibleAll(flag) {
                      setInvisibleAll(this.fVolume, flag);
                   },
                   Draw() {
                      if (!this.found || !this.fVolume) return;
                      result.obj = this.found.node;
                      result.prefix = this.found.item;
                      console.log(`Select volume for drawing ${this.fVolume.fName} ${result.prefix}`);
                   },
                   SetTransparency(lvl) {
                     if (this.fVolume?.fMedium?.fMaterial)
                        this.fVolume.fMedium.fMaterial.fFillStyle = 3000 + lvl;
                   },
                   SetLineColor(col) {
                      if (this.fVolume) this.fVolume.fLineColor = col;
                   }
                };
            },

            DefaultColors: () => {
               this.ctrl.dflt_colors = true;
            },

            SetMaxVisNodes: limit => {
               if (!this.ctrl.maxnodes)
                  this.ctrl.maxnodes = parseInt(limit) || 0;
            },

            SetVisLevel: limit => {
               if (!this.ctrl.vislevel)
                  this.ctrl.vislevel = parseInt(limit) || 0;
            }
          };

      showProgress(`Loading macro ${script_name}`);

      return httpRequest(script_name, 'text').then(script => {
         const lines = script.split('\n');
         let indx = 0;

         while (indx < lines.length) {
            let line = lines[indx++].trim();

            if (line.indexOf('//') === 0)
               continue;

            if (line.indexOf('gGeoManager') < 0) continue;
            line = line.replace('->GetVolume', '.GetVolume');
            line = line.replace('->InvisibleAll', '.InvisibleAll');
            line = line.replace('->SetMaxVisNodes', '.SetMaxVisNodes');
            line = line.replace('->DefaultColors', '.DefaultColors');
            line = line.replace('->Draw', '.Draw');
            line = line.replace('->SetTransparency', '.SetTransparency');
            line = line.replace('->SetLineColor', '.SetLineColor');
            line = line.replace('->SetVisLevel', '.SetVisLevel');
            if (line.indexOf('->') >= 0)
               continue;

            try {
               const func = new Function('gGeoManager', line);
               func(mgr);
            } catch {
               console.error(`Problem by processing ${line}`);
            }
         }

         return result;
      }).catch(() => {
         console.error(`Fail to load ${script_name}`);
         return result;
      });
   }

   /** @summary Extract shapes from draw message of geometry painter
     * @desc For the moment used in batch production */
   extractRawShapes(draw_msg, recreate) {
      let nodes = null, old_gradpersegm = 0;

      // array for descriptors for each node
      // if array too large (>1M), use JS object while only ~1K nodes are expected to be used
      if (recreate) {
         // if (draw_msg.kind !== 'draw') return false;
         nodes = (draw_msg.numnodes > 1e6) ? { length: draw_msg.numnodes } : new Array(draw_msg.numnodes); // array for all nodes
      }

      draw_msg.nodes.forEach(node => {
         node = ClonedNodes.formatServerElement(node);
         if (nodes)
            nodes[node.id] = node;
         else
            this.#clones.updateNode(node);
      });

      if (recreate) {
         this.assignClones(new ClonedNodes(null, nodes), true);
         this.#clones.name_prefix = this.#clones.getNodeName(0);
         this.#clones.setConfig(this.ctrl);

         // normally only need when making selection, not used in geo viewer
         // this.geo#clones.setMaxVisNodes(draw_msg.maxvisnodes);
         // this.geo#clones.setVisLevel(draw_msg.vislevel);
         // TODO: provide from server
         this.#clones.maxdepth = 20;
      }

      let nsegm = 0;
      if (draw_msg.cfg)
         nsegm = draw_msg.cfg.nsegm;

      if (nsegm) {
         old_gradpersegm = geoCfg('GradPerSegm');
         geoCfg('GradPerSegm', 360 / Math.max(nsegm, 6));
      }

      for (let cnt = 0; cnt < draw_msg.visibles.length; ++cnt) {
         const item = draw_msg.visibles[cnt], rd = item.ri;

         // entry may be provided without shape - it is ok
         if (rd)
            item.server_shape = rd.server_shape = createServerGeometry(rd, nsegm);
      }

      if (old_gradpersegm)
         geoCfg('GradPerSegm', old_gradpersegm);

      return true;
   }

   /** @summary Prepare drawings
     * @desc Return value used as promise for painter */
   async prepareObjectDraw(draw_obj, name_prefix) {
      // if did cleanup - ignore all kind of activity
      if (this.#did_cleanup)
         return null;

      if (name_prefix === '__geom_viewer_append__') {
         this.#new_append_nodes = draw_obj;
         this.ctrl.use_worker = 0;
         this.setGeomViewer(true); // indicate that working with geom viewer
      } else if ((name_prefix === '__geom_viewer_selection__') && this.#clones) {
         // these are selection done from geom viewer
         this.#new_draw_nodes = draw_obj;
         this.ctrl.use_worker = 0;
         this.setGeomViewer(true); // indicate that working with geom viewer
      } else if (this.getCentral())
         this.assignClones(this.getCentral().getClones(), false);
      else if (!draw_obj)
         this.assignClones(undefined, undefined);
      else {
         this.#start_drawing_time = new Date().getTime();
         this.assignClones(new ClonedNodes(draw_obj), true);
         let lvl = this.ctrl.vislevel, maxnodes = this.ctrl.maxnodes;
         if (this.#geo_manager) {
            if (!lvl && this.#geo_manager.fVisLevel)
               lvl = this.#geo_manager.fVisLevel;
            if (!maxnodes)
               maxnodes = this.#geo_manager.fMaxVisNodes;
         }

         this.#clones.setVisLevel(lvl);
         this.#clones.setMaxVisNodes(maxnodes, this.ctrl.more);
         this.#clones.setConfig(this.ctrl);

         this.#clones.name_prefix = name_prefix;

         const hide_top_volume = Boolean(this.#geo_manager) && !this.ctrl.showtop;
         let uniquevis = this.ctrl.no_screen ? 0 : this.#clones.markVisibles(true, false, hide_top_volume);

         if (uniquevis <= 0)
            uniquevis = this.#clones.markVisibles(false, false, hide_top_volume);
         else
            uniquevis = this.#clones.markVisibles(true, true, hide_top_volume); // copy bits once and use normal visibility bits

         this.#clones.produceIdShifts();

         const spent = new Date().getTime() - this.#start_drawing_time;

         if (!this.#scene && (settings.Debug || spent > 1000))
            console.log(`Creating clones ${this.#clones.nodes.length} takes ${spent} ms uniquevis ${uniquevis}`);

         if (this.ctrl._count)
            return this.drawCount(uniquevis, spent);
      }

      let promise = Promise.resolve(true);

      if (!this.#scene) {
         this.#first_drawing = true;

         const pp = this.getPadPainter();

         this.#on_pad = Boolean(pp);

         if (this.#on_pad) {
            let size, render3d, fp;
            promise = ensureTCanvas(this, '3d').then(() => {
               if (pp.fillatt?.color)
                  this.ctrl.background = pp.fillatt.color;
               fp = this.getFramePainter();

               this.batch_mode = pp.isBatchMode();

               render3d = getRender3DKind(undefined, this.batch_mode);
               assign3DHandler(fp);
               fp.mode3d = true;

               size = fp.getSizeFor3d(undefined, render3d);

               this.#fit_main_area = (size.can3d === -1);

               return this.createScene(size.width, size.height, render3d)
                          .then(dom => fp.add3dCanvas(size, dom, render3d === constants.Render3D.WebGL));
            });
         } else {
            const dom = this.selectDom('origin');

            this.batch_mode = isBatchMode() || (!dom.empty() && dom.property('_batch_mode'));
            this.batch_format = dom.property('_batch_format');

            const render3d = getRender3DKind(this.getOptions().Render3D, this.batch_mode);

            // activate worker
            if ((this.ctrl.use_worker > 0) && !this.batch_mode)
               this.startWorker();

            assign3DHandler(this);

            const size = this.getSizeFor3d(undefined, render3d);

            this.#fit_main_area = (size.can3d === -1);

            promise = this.createScene(size.width, size.height, render3d)
                          .then(dom2 => this.add3dCanvas(size, dom2, this.#webgl));
         }
      }

      return promise.then(() => {
         // this is limit for the visible faces, number of volumes does not matter
         if (this.#first_drawing && !this.ctrl.maxfaces)
            this.ctrl.maxfaces = 200000 * this.ctrl.more;

         // set top painter only when first child exists
         this.setAsMainPainter();

         this.createToolbar();

         // just draw extras and complete drawing if there are no main model
         if (!this.#clones)
            return this.completeDraw();

         return new Promise(resolveFunc => {
            this.#draw_resolveFuncs.push(resolveFunc);
            this.showDrawInfo('Drawing geometry');
            this.startDrawGeometry(true);
         });
      });
   }

   /** @summary methods show info when first geometry drawing is performed */
   showDrawInfo(msg) {
      if (this.isBatchMode() || !this.#first_drawing || !this.#start_drawing_time)
         return;

      const main = this.#renderer.domElement.parentNode;
      if (!main) return;

      let info = main.querySelector('.geo_info');

      if (!msg)
         info?.remove();
       else {
         const spent = (new Date().getTime() - this.#start_drawing_time)*1e-3;
         if (!info) {
            info = getDocument().createElement('p');
            info.setAttribute('class', 'geo_info');
            info.setAttribute('style', 'position: absolute; text-align: center; vertical-align: middle; top: 45%; left: 40%; color: red; font-size: 150%;');
            main.append(info);
         }
         info.innerHTML = `${msg}, ${spent.toFixed(1)}s`;
      }
   }

   /** @summary Reentrant method to perform geometry drawing step by step */
   continueDraw() {
      // nothing to do - exit
      if (this.isStage(stageInit)) return;

      const tm0 = new Date().getTime(),
            interval = this.#first_drawing ? 1000 : 200;
      let now = tm0;

      while (true) {
         const res = this.nextDrawAction();
         if (!res) break;

         now = new Date().getTime();

         // stop creation after 100 sec, render as is
         if (now - this.#start_render_tm > 1e5) {
            this.changeStage(stageInit, 'Abort build after 100s');
            break;
         }

         // if we are that fast, do next action
         if ((res === true) && (now - tm0 < interval))
            continue;

         if ((now - tm0 > interval) || (res === 1) || (res === 2)) {
            showProgress(this.#drawing_log);

            this.showDrawInfo(this.#drawing_log);

            if (this.#first_drawing && this.#webgl && (this.ctrl.info.num_meshes - this.#last_render_meshes > 100) && (now - this.#last_render_tm > 2.5*interval)) {
               this.adjustCameraPosition();
               this.render3D(-1);
               this.#last_render_meshes = this.ctrl.info.num_meshes;
            }
            if (res !== 2)
               setTimeout(() => this.continueDraw(), (res === 1) ? 100 : 1);

            return;
         }
      }

      const take_time = now - this.#start_render_tm;

      if ((this.#first_drawing || this.#full_redrawing) && (settings.Debug || take_time > 1000))
         console.log(`Create tm = ${take_time} meshes ${this.ctrl.info.num_meshes} faces ${this.ctrl.info.num_faces}`);

      if (take_time > 300) {
         showProgress('Rendering geometry');
         this.showDrawInfo('Rendering');
         return setTimeout(() => this.completeDraw(true), 10);
      }

      this.completeDraw(true);
   }

   /** @summary Checks camera position and recalculate rendering order if needed
     * @param force - if specified, forces calculations of render order */
   testCameraPosition(force) {
      this.#camera.updateMatrixWorld();

      this.drawOverlay();

      const origin = this.#camera.position.clone();
      if (!force && this.#last_camera_position) {
         // if camera position does not changed a lot, ignore such change
         const dist = this.#last_camera_position.distanceTo(origin);
         if (dist < (this.#overall_size || 1000)*1e-4) return;
      }

      this.#last_camera_position = origin; // remember current camera position

      if (this.ctrl._axis) {
         const vect = (this.#controls?.target || this.#lookat).clone().sub(this.#camera.position).normalize();
         this.getExtrasContainer('get', 'axis')?.traverse(obj3d => {
            if (isFunc(obj3d._axis_flip))
               obj3d._axis_flip(vect);
         });
      }

      if (!this.ctrl.project)
         produceRenderOrder(this.#toplevel, origin, this.ctrl.depthMethod, this.#clones);
   }

   /** @summary Call 3D rendering of the geometry
     * @param tmout - specifies delay, after which actual rendering will be invoked
     * @param [measure] - when true, for the first time printout rendering time
     * @return {Promise} when tmout bigger than 0 is specified
     * @desc Timeout used to avoid multiple rendering of the picture when several 3D drawings
     * superimposed with each other. If tmout <= 0, rendering performed immediately
     * Several special values are used:
     *   -1    - force recheck of rendering order based on camera position */
   render3D(tmout, measure) {
      if (!this.#renderer) {
         if (this.#did_cleanup)
            console.warn('try to render after cleanup');
         else
            console.warn('renderer object not exists - check code');
         return this;
      }

      const ret_promise = (tmout !== undefined) && (tmout > 0) && (measure !== 'nopromise');

      if (tmout === undefined)
         tmout = 5; // by default, rendering happens with timeout

      if ((tmout > 0) && this.#webgl) {
         if (this.isBatchMode())
            tmout = 1; // use minimal timeout in batch mode
         if (ret_promise) {
            return new Promise(resolveFunc => {
               this.#render_resolveFuncs.push(resolveFunc);
               if (!this.#render_tmout)
                  this.#render_tmout = setTimeout(() => this.render3D(0), tmout);
            });
         }

         if (!this.#render_tmout)
            this.#render_tmout = setTimeout(() => this.render3D(0), tmout);
         return this;
      }

      if (this.#render_tmout) {
         clearTimeout(this.#render_tmout);
         this.#render_tmout = undefined;
      }

      beforeRender3D(this.#renderer);

      const tm1 = new Date();

      if (this.#adjust_camera_with_render) {
         this.adjustCameraPosition('only_set');
         this.#adjust_camera_with_render = undefined;
      }

      this.testCameraPosition(tmout === -1);

      // its needed for outlinePass - do rendering, most consuming time
      if (this.#webgl && this.#effectComposer?.passes)
         this.#effectComposer.render();
       else if (this.#webgl && this.#bloomComposer?.passes) {
         this.#renderer.clear();
         this.#camera.layers.set(_BLOOM_SCENE);
         this.#bloomComposer.render();
         this.#renderer.clearDepth();
         this.#camera.layers.set(_ENTIRE_SCENE);
         this.#renderer.render(this.#scene, this.#camera);
      } else
         this.#renderer.render(this.#scene, this.#camera);

      const tm2 = new Date();

      this.#last_render_tm = tm2.getTime();

      if ((this.#first_render_tm === 0) && (measure === true)) {
         this.#first_render_tm = tm2.getTime() - tm1.getTime();
         if (this.#first_render_tm > 500)
            console.log(`three.js r${THREE.REVISION}, first render tm = ${this.#first_render_tm}`);
      }

      afterRender3D(this.#renderer);

      const arr = this.#render_resolveFuncs;
      this.#render_resolveFuncs = [];
      arr?.forEach(func => func(this));
   }

   /** @summary Start geo worker */
   async startWorker() {
      if (this.#worker)
         return;

      this.#worker_ready = false;
      this.#worker_jobs = 0; // counter how many requests send to worker

      let pr;

      if (isNodeJs()) {
         pr = import('node:worker_threads').then(h => {
            const wrk = new h.Worker(source_dir.slice(7) + 'modules/geom/nodeworker.mjs', { type: 'module' });
            wrk.on('message', msg => this.processWorkerReply(msg));
            return wrk;
         });
      } else {
         // Finally use ES6 module, see https://www.codedread.com/blog/archives/2017/10/19/web-workers-can-be-es6-modules-too/
         const wrk = new Worker(source_dir + 'modules/geom/geoworker.mjs', { type: 'module' });
         wrk.onmessage = e => this.processWorkerReply(e?.data);
         pr = Promise.resolve(wrk);
      }

      return pr.then(wrk => {
         this.#worker = wrk;
         // send initialization message with clones
         wrk.postMessage({
            init: true,   // indicate init command for worker
            tm0: new Date().getTime(),
            vislevel: this.#clones.getVisLevel(),
            maxvisnodes: this.#clones.getMaxVisNodes(),
            clones: this.#clones.nodes,
            sortmap: this.#clones.sortmap
         });
      });
   }

   /** @summary check if one can submit request to worker
     * @private */
   canSubmitToWorker(force) {
      return this.#worker ? this.#worker_ready && ((this.#worker_jobs === 0) || force) : false;
   }

   /** @summary submit request to worker
     * @private */
   submitToWorker(job) {
      if (!this.#worker)
         return false;

      this.#worker_jobs++;
      job.tm0 = new Date().getTime();
      this.#worker.postMessage(job);
   }

   /** @summary process reply from worker
     * @private */
   processWorkerReply(job) {
      if (!job || !isObject(job))
         return;

      if (job.log)
         return console.log(`geo: ${job.log}`);

      if (job.progress)
         return showProgress(job.progress);

      job.tm3 = new Date().getTime();

      if (job.init) {
         this.#worker_ready = true;
         return;
      }

      this.#worker_jobs--;

      if ('collect' in job) {
         this.#new_draw_nodes = job.new_nodes;
         this.#draw_all_nodes = job.complete;
         this.changeStage(stageAnalyze);
         // invoke methods immediately
         return this.continueDraw();
      }

      if ('shapes' in job) {
         for (let n=0; n<job.shapes.length; ++n) {
            const item = job.shapes[n],
                  origin = this.#build_shapes[n];

            if (item.buf_pos && item.buf_norm) {
               if (!item.buf_pos.length)
                  origin.geom = null;
                else if (item.buf_pos.length !== item.buf_norm.length) {
                  console.error(`item.buf_pos.length ${item.buf_pos.length} !== item.buf_norm.length ${item.buf_norm.length}`);
                  origin.geom = null;
               } else {
                  origin.geom = new THREE.BufferGeometry();

                  origin.geom.setAttribute('position', new THREE.BufferAttribute(item.buf_pos, 3));
                  origin.geom.setAttribute('normal', new THREE.BufferAttribute(item.buf_norm, 3));
               }

               origin.ready = true;
               origin.nfaces = item.nfaces;
            }
         }

         job.tm4 = new Date().getTime();

         this.changeStage(stageBuild); // first check which shapes are used, than build meshes

         // invoke methods immediately
         return this.continueDraw();
      }
   }

   /** @summary start draw geometries on central and all subordinate painters
     * @private */
   testGeomChanges() {
      if (this.getCentral()) {
         console.warn('Get testGeomChanges call for subordinate painter');
         return this.getCentral().testGeomChanges();
      }
      this.startDrawGeometry();
      this.getSubordinates()?.forEach(p => p.startDrawGeometry());
   }

   /** @summary Draw axes and camera overlay */
   drawAxesAndOverlay(norender) {
      const res1 = this.drawAxes(),
            res2 = this.drawOverlay();

      if (!res1 && !res2)
         return norender ? null : this.render3D();

      return this.changedDepthMethod(norender ? 'norender' : undefined);
   }

   /** @summary Draw overlay for the orthographic cameras */
   drawOverlay() {
      this.getExtrasContainer('delete', 'overlay');
      if (!this.isOrthoCamera() || (this.ctrl.camera_overlay === 'none'))
         return false;

      const zoom = 0.5 / this.#camera.zoom,
            midx = (this.#camera.left + this.#camera.right) / 2,
            midy = (this.#camera.bottom + this.#camera.top) / 2,
            xmin = midx - (this.#camera.right - this.#camera.left) * zoom,
            xmax = midx + (this.#camera.right - this.#camera.left) * zoom,
            ymin = midy - (this.#camera.top - this.#camera.bottom) * zoom,
            ymax = midy + (this.#camera.top - this.#camera.bottom) * zoom,
            tick_size = (ymax - ymin) * 0.02,
            text_size = (ymax - ymin) * 0.015,
            grid_gap = (ymax - ymin) * 0.001,
            x1 = xmin + text_size * 5, x2 = xmax - text_size * 5,
            y1 = ymin + text_size * 3, y2 = ymax - text_size * 3,
            x_handle = new TAxisPainter(null, create(clTAxis));

      x_handle.configureAxis('xaxis', x1, x2, x1, x2, false, [x1, x2],
                             { log: 0, reverse: false });
      const y_handle = new TAxisPainter(null, create(clTAxis));
      y_handle.configureAxis('yaxis', y1, y2, y1, y2, false, [y1, y2],
                              { log: 0, reverse: false });

      const ii = this.#camera.orthoIndicies ?? [0, 1, 2];
      let buf, pos, midZ = 0, gridZ = 0;

      if (this.#camera.orthoZ)
         gridZ = midZ = this.#camera.orthoZ[0];

      const addPoint = (x, y, z) => {
         buf[pos+ii[0]] = x;
         buf[pos+ii[1]] = y;
         buf[pos+ii[2]] = z ?? gridZ;
         pos += 3;
      }, createText = (lbl, size) => {
         const text3d = createTextGeometry(lbl, size);
         text3d.computeBoundingBox();
         text3d._width = text3d.boundingBox.max.x - text3d.boundingBox.min.x;
         text3d._height = text3d.boundingBox.max.y - text3d.boundingBox.min.y;

         text3d.translate(-text3d._width/2, -text3d._height/2, 0);
         if (this.#camera.orthoSign < 0)
            text3d.rotateY(Math.PI);

         if (isFunc(this.#camera.orthoRotation))
            this.#camera.orthoRotation(text3d);

         return text3d;
      }, createTextMesh = (geom, material, x, y, z) => {
         const tgt = [0, 0, 0];
         tgt[ii[0]] = x;
         tgt[ii[1]] = y;
         tgt[ii[2]] = z ?? gridZ;
         const mesh = new THREE.Mesh(geom, material);
         mesh.translateX(tgt[0]).translateY(tgt[1]).translateZ(tgt[2]);
         return mesh;
      };

      if (this.ctrl.camera_overlay === 'bar') {
         const container = this.getExtrasContainer('create', 'overlay');

         let ox1 = xmin * 0.15 + xmax * 0.85,
             ox2 = xmin * 0.05 + xmax * 0.95;
         const oy1 = ymax * 0.9 + ymin * 0.1,
               oy2 = ymax * 0.86 + ymin * 0.14,
               ticks = x_handle.createTicks();

         if (ticks.major?.length > 1) {
            ox1 = ticks.major.at(-2);
            ox2 = ticks.major.at(-1);
         }

         buf = new Float32Array(3*6);
         pos = 0;

         addPoint(ox1, oy1, midZ);
         addPoint(ox1, oy2, midZ);

         addPoint(ox1, (oy1 + oy2) / 2, midZ);
         addPoint(ox2, (oy1 + oy2) / 2, midZ);

         addPoint(ox2, oy1, midZ);
         addPoint(ox2, oy2, midZ);

         const lineMaterial = new THREE.LineBasicMaterial({ color: 'green' }),
               textMaterial = new THREE.MeshBasicMaterial({ color: 'green', vertexColors: false });

         container.add(createLineSegments(buf, lineMaterial));

         const text3d = createText(x_handle.format(ox2 - ox1, true), Math.abs(oy2 - oy1));

         container.add(createTextMesh(text3d, textMaterial, (ox2 + ox1) / 2, (oy1 + oy2) / 2 + text3d._height * 0.8, midZ));
         return true;
      }

      const show_grid = this.ctrl.camera_overlay.indexOf('grid') === 0;

      if (show_grid && this.#camera.orthoZ) {
         if (this.ctrl.camera_overlay === 'gridf')
            gridZ += this.#camera.orthoSign * this.#camera.orthoZ[1];
         else if (this.ctrl.camera_overlay === 'gridb')
            gridZ -= this.#camera.orthoSign * this.#camera.orthoZ[1];
      }

      if ((this.ctrl.camera_overlay === 'axis') || show_grid) {
         const container = this.getExtrasContainer('create', 'overlay'),
               lineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color('black') }),
               gridMaterial1 = show_grid ? new THREE.LineBasicMaterial({ color: new THREE.Color(0xbbbbbb) }) : null,
               gridMaterial2 = show_grid ? new THREE.LineDashedMaterial({ color: new THREE.Color(0xdddddd), dashSize: grid_gap, gapSize: grid_gap }) : null,
               textMaterial = new THREE.MeshBasicMaterial({ color: 'black', vertexColors: false }),
               xticks = x_handle.createTicks();

         while (xticks.next()) {
            const x = xticks.tick, k = (xticks.kind === 1) ? 1.0 : 0.6;

            if (show_grid) {
               buf = new Float32Array(2*3); pos = 0;
               addPoint(x, ymax - k*tick_size - grid_gap);
               addPoint(x, ymin + k*tick_size + grid_gap);
               container.add(createLineSegments(buf, xticks.kind === 1 ? gridMaterial1 : gridMaterial2));
            }

            buf = new Float32Array(4*3); pos = 0;
            addPoint(x, ymax);
            addPoint(x, ymax - k*tick_size);
            addPoint(x, ymin);
            addPoint(x, ymin + k*tick_size);

            container.add(createLineSegments(buf, lineMaterial));

            if (xticks.kind !== 1) continue;

            const text3d = createText(x_handle.format(x, true), text_size);

            container.add(createTextMesh(text3d, textMaterial, x, ymax - tick_size - text_size/2 - text3d._height/2));

            container.add(createTextMesh(text3d, textMaterial, x, ymin + tick_size + text_size/2 + text3d._height/2));
         }

         const yticks = y_handle.createTicks();

         while (yticks.next()) {
            const y = yticks.tick, k = (yticks.kind === 1) ? 1.0 : 0.6;

            if (show_grid) {
               buf = new Float32Array(2*3); pos = 0;
               addPoint(xmin + k*tick_size + grid_gap, y);
               addPoint(xmax - k*tick_size - grid_gap, y);
               container.add(createLineSegments(buf, yticks.kind === 1 ? gridMaterial1 : gridMaterial2));
            }

            buf = new Float32Array(4*3); pos = 0;
            addPoint(xmin, y);
            addPoint(xmin + k*tick_size, y);
            addPoint(xmax, y);
            addPoint(xmax - k*tick_size, y);

            container.add(createLineSegments(buf, lineMaterial));

            if (yticks.kind !== 1) continue;

            const text3d = createText(y_handle.format(y, true), text_size);

            container.add(createTextMesh(text3d, textMaterial, xmin + tick_size + text_size/2 + text3d._width/2, y));

            container.add(createTextMesh(text3d, textMaterial, xmax - tick_size - text_size/2 - text3d._width/2, y));
         }

         return true;
      }

      return false;
   }

   /** @summary Draw axes if configured, otherwise just remove completely */
   drawAxes() {
      this.getExtrasContainer('delete', 'axis');

      if (!this.ctrl._axis)
         return false;

      const box = this.getGeomBoundingBox(this.#toplevel, this.#superimpose ? 'original' : undefined),
          container = this.getExtrasContainer('create', 'axis'),
          text_size = 0.02 * Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z),
          center = [0, 0, 0],
          names = ['x', 'y', 'z'],
          labels = ['X', 'Y', 'Z'],
          colors = ['red', 'green', 'blue'],
          ortho = this.isOrthoCamera(),
          ckind = this.ctrl.camera_kind ?? 'perspective';

      if (this.ctrl._axis === 2) {
         for (let naxis = 0; naxis < 3; ++naxis) {
            const name = names[naxis];
            if ((box.min[name] <= 0) && (box.max[name] >= 0)) continue;
            center[naxis] = (box.min[name] + box.max[name])/2;
         }
      }

      for (let naxis = 0; naxis < 3; ++naxis) {
         // exclude axis which is not seen
         if (ortho && ckind.indexOf(labels[naxis]) < 0) continue;

         const buf = new Float32Array(6),
               color = colors[naxis],
               name = names[naxis],

          valueToString = val => {
            if (!val) return '0';
            const lg = Math.log10(Math.abs(val));
            if (lg < 0) {
               if (lg > -1) return val.toFixed(2);
               if (lg > -2) return val.toFixed(3);
            } else {
               if (lg < 2) return val.toFixed(1);
               if (lg < 4) return val.toFixed(0);
            }
            return val.toExponential(2);
         },

          lbl = valueToString(box.max[name]) + ' ' + labels[naxis];

         buf[0] = box.min.x;
         buf[1] = box.min.y;
         buf[2] = box.min.z;

         buf[3] = box.min.x;
         buf[4] = box.min.y;
         buf[5] = box.min.z;

         switch (naxis) {
           case 0: buf[3] = box.max.x; break;
           case 1: buf[4] = box.max.y; break;
           case 2: buf[5] = box.max.z; break;
         }

         if (this.ctrl._axis === 2) {
            for (let k = 0; k < 6; ++k)
               if ((k % 3) !== naxis) buf[k] = center[k%3];
         }

         const lineMaterial = new THREE.LineBasicMaterial({ color });
         let mesh = createLineSegments(buf, lineMaterial);

         mesh._no_clip = true; // skip from clipping

         container.add(mesh);

         const textMaterial = new THREE.MeshBasicMaterial({ color, vertexColors: false });

         if ((center[naxis] === 0) && (center[naxis] >= box.min[name]) && (center[naxis] <= box.max[name])) {
            if ((this.ctrl._axis !== 2) || (naxis === 0)) {
               const geom = ortho ? new THREE.CircleGeometry(text_size*0.25) : new THREE.SphereGeometry(text_size*0.25);
               mesh = new THREE.Mesh(geom, textMaterial);
               mesh.translateX(naxis === 0 ? center[0] : buf[0]);
               mesh.translateY(naxis === 1 ? center[1] : buf[1]);
               mesh.translateZ(naxis === 2 ? center[2] : buf[2]);
               mesh._no_clip = true;
               container.add(mesh);
            }
         }

         let text3d = createTextGeometry(lbl, text_size);
         mesh = new THREE.Mesh(text3d, textMaterial);
         mesh._no_clip = true; // skip from clipping

         function setSideRotation(mesh2, normal) {
            mesh2._other_side = false;
            mesh2._axis_norm = normal ?? new THREE.Vector3(1, 0, 0);
            mesh2._axis_flip = function(vect) {
               const other_side = vect.dot(this._axis_norm) < 0;
               if (this._other_side !== other_side) {
                  this._other_side = other_side;
                  this.rotateY(Math.PI);
               }
            };
         }

         function setTopRotation(mesh2, first_angle = -1) {
            mesh2._last_angle = first_angle;
            mesh2._axis_flip = function(vect) {
               let angle;
               switch (this._axis_name) {
                  case 'x': angle = -Math.atan2(vect.y, vect.z); break;
                  case 'y': angle = -Math.atan2(vect.z, vect.x); break;
                  default: angle = Math.atan2(vect.y, vect.x);
               }
               angle = Math.round(angle / Math.PI * 2 + 2) % 4;
               if (this._last_angle !== angle) {
                  this.rotateX((angle - this._last_angle) * Math.PI/2);
                  this._last_angle = angle;
               }
            };
         }

         let textbox = new THREE.Box3().setFromObject(mesh);

         text3d.translate(-textbox.max.x*0.5, -textbox.max.y/2, 0);

         mesh.translateX(buf[3]);
         mesh.translateY(buf[4]);
         mesh.translateZ(buf[5]);

         mesh._axis_name = name;

         if (naxis === 0) {
            if (ortho && ckind.indexOf('OX') > 0)
               setTopRotation(mesh, 0);
             else if (ortho ? ckind.indexOf('OY') > 0 : this.ctrl._yup)
               setSideRotation(mesh, new THREE.Vector3(0, 0, -1));
             else {
               setSideRotation(mesh, new THREE.Vector3(0, 1, 0));
               mesh.rotateX(Math.PI/2);
            }

            mesh.translateX(text_size*0.5 + textbox.max.x*0.5);
         } else if (naxis === 1) {
            if (ortho ? ckind.indexOf('OY') > 0 : this.ctrl._yup) {
               setTopRotation(mesh, 2);
               mesh.rotateX(-Math.PI/2);
               mesh.rotateY(-Math.PI/2);
               mesh.translateX(text_size*0.5 + textbox.max.x*0.5);
            } else {
               setSideRotation(mesh);
               mesh.rotateX(Math.PI/2);
               mesh.rotateY(-Math.PI/2);
               mesh.translateX(-textbox.max.x*0.5 - text_size*0.5);
            }
         } else if (naxis === 2) {
            if (ortho ? ckind.indexOf('OZ') < 0 : this.ctrl._yup) {
               const zox = ortho && (ckind.indexOf('ZOX') > 0 || ckind.indexOf('ZNOX') > 0);
               setSideRotation(mesh, zox ? new THREE.Vector3(0, -1, 0) : undefined);
               mesh.rotateY(-Math.PI/2);
               if (zox) mesh.rotateX(-Math.PI/2);
            } else {
               setTopRotation(mesh);
               mesh.rotateX(Math.PI/2);
               mesh.rotateZ(Math.PI/2);
            }
            mesh.translateX(text_size*0.5 + textbox.max.x*0.5);
         }

         container.add(mesh);

         text3d = createTextGeometry(valueToString(box.min[name]), text_size);

         mesh = new THREE.Mesh(text3d, textMaterial);
         mesh._no_clip = true; // skip from clipping
         textbox = new THREE.Box3().setFromObject(mesh);

         text3d.translate(-textbox.max.x*0.5, -textbox.max.y/2, 0);

         mesh._axis_name = name;

         mesh.translateX(buf[0]);
         mesh.translateY(buf[1]);
         mesh.translateZ(buf[2]);

         if (naxis === 0) {
            if (ortho && ckind.indexOf('OX') > 0)
               setTopRotation(mesh, 0);
             else if (ortho ? ckind.indexOf('OY') > 0 : this.ctrl._yup)
               setSideRotation(mesh, new THREE.Vector3(0, 0, -1));
             else {
               setSideRotation(mesh, new THREE.Vector3(0, 1, 0));
               mesh.rotateX(Math.PI/2);
            }
            mesh.translateX(-text_size*0.5 - textbox.max.x*0.5);
         } else if (naxis === 1) {
            if (ortho ? ckind.indexOf('OY') > 0 : this.ctrl._yup) {
               setTopRotation(mesh, 2);
               mesh.rotateX(-Math.PI/2);
               mesh.rotateY(-Math.PI/2);
               mesh.translateX(-textbox.max.x*0.5 - text_size*0.5);
            } else {
               setSideRotation(mesh);
               mesh.rotateX(Math.PI/2);
               mesh.rotateY(-Math.PI/2);
               mesh.translateX(textbox.max.x*0.5 + text_size*0.5);
            }
         } else if (naxis === 2) {
            if (ortho ? ckind.indexOf('OZ') < 0 : this.ctrl._yup) {
               const zox = ortho && (ckind.indexOf('ZOX') > 0 || ckind.indexOf('ZNOX') > 0);
               setSideRotation(mesh, zox ? new THREE.Vector3(0, -1, 0) : undefined);
               mesh.rotateY(-Math.PI/2);
               if (zox) mesh.rotateX(-Math.PI/2);
            } else {
               setTopRotation(mesh);
               mesh.rotateX(Math.PI/2);
               mesh.rotateZ(Math.PI/2);
            }
            mesh.translateX(-textbox.max.x*0.5 - text_size*0.5);
         }

         container.add(mesh);
      }

      // after creating axes trigger rendering and recalculation of depth
      return true;
   }

   /** @summary Set axes visibility 0 - off, 1 - on, 2 - centered */
   setAxesDraw(on) {
      if (on === 'toggle')
         this.ctrl._axis = this.ctrl._axis ? 0 : 1;
      else
         this.ctrl._axis = (typeof on === 'number') ? on : (on ? 1 : 0);
      return this.drawAxesAndOverlay();
   }

   /** @summary Set auto rotate mode */
   setAutoRotate(on) {
      if (this.ctrl.project) return;
      if (on !== undefined) this.ctrl.rotate = on;
      this.autorotate(2.5);
   }

   /** @summary Toggle wireframe mode */
   toggleWireFrame() {
      this.ctrl.wireframe = !this.ctrl.wireframe;
      this.changedWireFrame();
   }

   /** @summary Specify wireframe mode */
   setWireFrame(on) {
      this.ctrl.wireframe = Boolean(on);
      this.changedWireFrame();
   }

   /** @summary Specify showtop draw options, relevant only for TGeoManager */
   setShowTop(on) {
      this.ctrl.showtop = Boolean(on);
      return this.startRedraw();
   }

   /** @summary Should be called when configuration of particular axis is changed */
   changedClipping(naxis = -1) {
      if ((naxis < 0) || this.ctrl.clip[naxis]?.enabled)
         this.updateClipping(false, true);
   }

   /** @summary Should be called when depth test flag is changed */
   changedDepthTest() {
      if (!this.#toplevel) return;
      const flag = this.ctrl.depthTest;
      this.#toplevel.traverse(node => {
         if (node instanceof THREE.Mesh)
            node.material.depthTest = flag;
      });

      this.render3D(0);
   }

   /** @summary Should be called when depth method is changed */
   changedDepthMethod(arg) {
      // force recalculation of render order
      this.#last_camera_position = undefined;
      if (arg !== 'norender')
         return this.render3D();
   }

   /** @summary Assign clipping attributes to the meshes - supported only for webgl */
   updateClipping(without_render, force_traverse) {
      // do not try clipping with SVG renderer
      if (this.#renderer?.jsroot_render3d === constants.Render3D.SVG) return;

      if (!this.#clip_planes) {
         this.#clip_planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
                             new THREE.Plane(new THREE.Vector3(0, this.ctrl._yup ? -1 : 1, 0), 0),
                             new THREE.Plane(new THREE.Vector3(0, 0, this.ctrl._yup ? 1 : -1), 0)];
      }

      const clip = this.ctrl.clip,
            clip_constants = [-1 * clip[0].value, clip[1].value, (this.ctrl._yup ? -1 : 1) * clip[2].value],
            container = this.getExtrasContainer(this.ctrl.clipVisualize ? '' : 'delete', 'clipping');
      let panels = [], changed = false,
          clip_cfg = this.ctrl.clipIntersect ? 16 : 0;

      for (let k = 0; k < 3; ++k) {
         if (clip[k].enabled)
            clip_cfg += 2 << k;
         if (this.#clip_planes[k].constant !== clip_constants[k]) {
            if (clip[k].enabled) changed = true;
            this.#clip_planes[k].constant = clip_constants[k];
         }
         if (clip[k].enabled)
            panels.push(this.#clip_planes[k]);

         if (container && clip[k].enabled) {
            const helper = new THREE.PlaneHelper(this.#clip_planes[k], (clip[k].max - clip[k].min));
            helper._no_clip = true;
            container.add(helper);
         }
      }
      if (!panels.length)
         panels = null;

      if (this.#last_clip_cfg !== clip_cfg)
         changed = true;

      this.#last_clip_cfg = clip_cfg;

      const any_clipping = Boolean(panels), ci = this.ctrl.clipIntersect,
            material_side = any_clipping ? THREE.DoubleSide : THREE.FrontSide;

      if (force_traverse || changed) {
         this.#scene.traverse(node => {
            if (!node._no_clip && (node.material?.clippingPlanes !== undefined)) {
               if (node.material.clippingPlanes !== panels) {
                  node.material.clipIntersection = ci;
                  node.material.clippingPlanes = panels;
                  node.material.needsUpdate = true;
               }

               if (node.material.emissive !== undefined) {
                  if (node.material.side !== material_side) {
                     node.material.side = material_side;
                     node.material.needsUpdate = true;
                  }
               }
            }
         });
      }

      this.ctrl.doubleside = any_clipping;

      if (!without_render) this.render3D(0);

      return changed;
   }

   /** @summary Assign callback, invoked every time when drawing is completed
     * @desc Used together with web-based geometry viewer
     * @private */
   setCompleteHandler(callback) {
      this.#complete_handler = callback;
   }

   /** @summary Completes drawing procedure
     * @return {Promise} for ready */
   async completeDraw(close_progress) {
      let first_time = false, full_redraw = false, check_extras = true;

      if (!this.ctrl) {
         console.warn('ctrl object does not exist in completeDraw - something went wrong');
         return this;
      }

      let promise;

      if (!this.#clones) {
         check_extras = false;
         // if extra object where append, redraw them at the end
         this.getExtrasContainer('delete'); // delete old container
         promise = this.drawExtras(this.getCentral()?.getExtraObjects() || this.getExtraObjects(), '', false);
      } else if ((this.#first_drawing || this.#full_redrawing) && this.ctrl.tracks && this.#geo_manager)
         promise = this.drawExtras(this.#geo_manager.fTracks, '<prnt>/Tracks');
      else
         promise = Promise.resolve(true);

      return promise.then(() => {
         if (this.#full_redrawing) {
            this.adjustCameraPosition('first');
            this.#full_redrawing = false;
            full_redraw = true;
            this.changedDepthMethod('norender');
         }

         if (this.#first_drawing) {
            this.adjustCameraPosition('first');
            this.showDrawInfo();
            this.#first_drawing = false;
            first_time = true;
            full_redraw = true;
         }

         if (first_time)
            this.completeScene();

         if (full_redraw && (this.ctrl.trans_radial || this.ctrl.trans_z))
            this.changedTransformation('norender');

         if (full_redraw)
            return this.drawAxesAndOverlay(true);
      }).then(() => {
         this.#scene.overrideMaterial = null;

         if (this.#provided_more_nodes !== undefined) {
            this.appendMoreNodes(this.#provided_more_nodes, true);
            this.#provided_more_nodes = undefined;
         }

         if (check_extras) {
            // if extra object where append, redraw them at the end
            this.getExtrasContainer('delete'); // delete old container
            return this.drawExtras(this.getCentral()?.getExtraObjects() || this.getExtraObjects(), '', false);
         }
      }).then(() => {
         this.updateClipping(true); // do not render

         this.render3D(0, true);

         if (close_progress)
            showProgress();

         this.addOrbitControls();

         if (first_time && !this.isBatchMode()) {
            // after first draw check if highlight can be enabled
            if (this.ctrl.highlight === 0)
               this.ctrl.highlight = (this.#first_render_tm < 1000);

            // also highlight of scene object can be assigned at the first draw
            if (this.ctrl.highlight_scene === 0)
               this.ctrl.highlight_scene = this.ctrl.highlight;

            // if rotation was enabled, do it
            if (this.#webgl && this.ctrl.rotate && !this.ctrl.project)
               this.autorotate(2.5);
            if (this.#webgl && this.ctrl.show_controls)
               this.showControlGui(true);
         }

         this.setAsMainPainter();

         const arr = this.#draw_resolveFuncs;
         this.#draw_resolveFuncs = [];
         arr?.forEach(func => func(this));

         if (isFunc(this.#complete_handler))
            this.#complete_handler(this);

         if (this.#draw_nodes_again)
            this.startDrawGeometry(); // relaunch drawing
         else
            this.#drawing_ready = true; // indicate that drawing is completed

         return this;
      });
   }

   /** @summary Returns true if geometry drawing is completed */
   isDrawingReady() { return this.#drawing_ready ?? false; }

   /** @summary Remove already drawn node. Used by geom viewer */
   removeDrawnNode(nodeid) {
      if (!this.#draw_nodes) return;

      const new_nodes = [];

      for (let n = 0; n < this.#draw_nodes.length; ++n) {
         const entry = this.#draw_nodes[n];
         if ((entry.nodeid === nodeid) || this.#clones.isIdInStack(nodeid, entry.stack))
            this.#clones.createObject3D(entry.stack, this.#toplevel, 'delete_mesh');
          else
            new_nodes.push(entry);
      }

      if (new_nodes.length < this.#draw_nodes.length) {
         this.#draw_nodes = new_nodes;
         this.render3D();
      }
   }

   /** @summary Cleanup geometry painter */
   cleanup(first_time) {
      if (!first_time) {
         let can3d = 0;

         if (!this.#superimpose) {
            this.clearTopPainter(); // remove as pointer

            if (this.#on_pad) {
               const fp = this.getFramePainter();
               if (fp?.mode3d) {
                  fp.clear3dCanvas();
                  fp.mode3d = false;
               }
            } else if (isFunc(this.clear3dCanvas))
               can3d = this.clear3dCanvas(); // remove 3d canvas from main HTML element

            disposeThreejsObject(this.#scene);
         }

         this.#toolbar?.cleanup(); // remove toolbar

         disposeThreejsObject(this.#fullgeom_proj);

         this.#controls?.cleanup();

         this.#gui?.destroy();

         this.#worker?.terminate();

         this.#animating = undefined;

         const obj = this.getGeometry();
         if (obj && this.ctrl.is_main) {
            if (obj.$geo_painter === this)
               delete obj.$geo_painter;
            else if (obj.fVolume?.$geo_painter === this)
               delete obj.fVolume.$geo_painter;
         }

         this.#central_painter?.assignSubordinate(this, false);
         this.#subordinate_painters?.forEach(p => {
            p.assignCentral(this, false);
            if (p.getClones() === this.getClones())
               p.assignClones(undefined, undefined);
         });

         this.#geo_manager = undefined;
         this.#highlight_handlers = undefined;

         super.cleanup();

         delete this.ctrl;

         this.#did_cleanup = true;

         if (can3d < 0)
            this.selectDom().html('');
      }

      this.#central_painter = undefined;
      this.#subordinate_painters = [];

      const arr = this.#render_resolveFuncs;
      this.#render_resolveFuncs = [];
      arr?.forEach(func => func(this));

      if (!this.#superimpose)
         cleanupRender3D(this.#renderer);

      this.ensureBloom(false);
      this.#effectComposer = undefined;

      this.#scene = undefined;
      this.#scene_size = undefined;
      this.#scene_width = 0;
      this.#scene_height = 0;
      this.#renderer = null;
      this.#toplevel = null;
      this.#fullgeom_proj = undefined;
      this.#fog = undefined;
      this.#camera= undefined;
      this.#camera0pos = undefined;
      this.#lookat = undefined;
      this.#selected_mesh = undefined;
      this.#custom_bounding_box = undefined;

      this.assignClones(undefined, undefined);
      this.#new_draw_nodes = undefined;
      this.#new_append_nodes = undefined;
      this.#last_camera_position = undefined;

      this.#on_pad = undefined;

      this.#start_render_tm = 0;
      this.#first_render_tm = 0; // time needed for first rendering
      this.#last_render_tm = 0;

      this.changeStage(stageInit, 'cleanup');
      this.#drawing_log = undefined;

      this.#gui = undefined;
      this.#controls = undefined;
      this.#toolbar = undefined;

      this.#worker = undefined;
   }

   /** @summary perform resize */
   performResize(width, height) {
      if ((this.#scene_width === width) && (this.#scene_height === height))
         return false;
      if ((width < 10) || (height < 10)) return false;

      this.#scene_width = width;
      this.#scene_height = height;

      if (this.#camera && this.#renderer) {
         if (this.#camera.isPerspectiveCamera)
            this.#camera.aspect = this.#scene_width / this.#scene_height;
         else if (this.#camera.isOrthographicCamera)
            this.adjustCameraPosition(true, true);
         this.#camera.updateProjectionMatrix();
         this.#renderer.setSize(this.#scene_width, this.#scene_height, !this.#fit_main_area);
         this.#effectComposer?.setSize(this.#scene_width, this.#scene_height);
         this.#bloomComposer?.setSize(this.#scene_width, this.#scene_height);

         if (this.isStage(stageInit))
            this.render3D();
      }

      return true;
   }

   /** @summary Check if HTML element was resized and drawing need to be adjusted */
   checkResize(arg) {
      const cp = this.getCanvPainter();

      // firefox is the only browser which correctly supports resize of embedded canvas,
      // for others we should force canvas redrawing at every step
      if (cp && !cp.checkCanvasResize(arg))
         return false;

      const sz = this.getSizeFor3d();
      return this.performResize(sz.width, sz.height);
   }

   /** @summary Toggle enlarge state */
   toggleEnlarge() {
      if (this.enlargeMain('toggle'))
        this.checkResize();
   }

   /** @summary either change mesh wireframe or return current value
     * @return undefined when wireframe cannot be accessed
     * @private */
   accessObjectWireFrame(obj, on) {
      if (!obj?.material)
         return;

      if ((on !== undefined) && obj.stack)
         obj.material.wireframe = on;

      return obj.material.wireframe;
   }

   /** @summary handle wireframe flag change in GUI
     * @private */
   changedWireFrame() {
      this.#scene?.traverse(obj => this.accessObjectWireFrame(obj, this.ctrl.wireframe));

      this.render3D();
   }

   /** @summary Update object in geo painter */
   updateObject(obj) {
      if ((obj === 'same') || !obj?._typename)
         return false;
      if (obj === this.getObject())
         return true;

      let gm;
      if (obj._typename === clTGeoManager) {
         gm = obj;
         obj = obj.fMasterVolume;
      }

      if (obj._typename.indexOf(clTGeoVolume) === 0)
         obj = { _typename: clTGeoNode, fVolume: obj, fName: obj.fName, $geoh: obj.$geoh, _proxy: true };

      if (this.#geo_manager && gm) {
         this.#geo_manager = gm;
         this.assignObject(obj);
         this.#did_update = true;
         return true;
      }

      if (!this.matchObjectType(obj._typename))
         return false;

      this.assignObject(obj);
      this.#did_update = true;
      return true;
   }

   /** @summary Cleanup TGeo drawings */
   clearDrawings() {
      this.assignClones(undefined, undefined);

      this.#extra_objects = undefined;
      this.#last_clip_cfg = undefined;

      // only remove all childs from top level object
      disposeThreejsObject(this.#toplevel, true);

      this.#full_redrawing = true;
   }

    /** @summary Redraw TGeo object inside TPad */
   redraw() {
      if (this.#superimpose) {
         const cfg = getHistPainter3DCfg(this.getMainPainter());

         if (cfg) {
            this.#toplevel.scale.set(cfg.scale_x ?? 1, cfg.scale_y ?? 1, cfg.scale_z ?? 1);
            this.#toplevel.position.set(cfg.offset_x ?? 0, cfg.offset_y ?? 0, cfg.offset_z ?? 0);
            this.#toplevel.updateMatrix();
            this.#toplevel.updateMatrixWorld();
         }
      }

      if (this.#did_update)
         return this.startRedraw();

      const fp = this.#on_pad ? this.getFramePainter() : null;
      if (!fp)
         return Promise.resolve(false);
      const sz = fp.getSizeFor3d(fp.access3dKind());
      fp.apply3dSize(sz);
      return this.performResize(sz.width, sz.height);
   }

   /** @summary Redraw TGeo object */
   redrawObject(obj, opt) {
      if (!this.updateObject(obj, opt))
         return false;

      return this.startRedraw();
   }

   /** @summary Start geometry redraw */
   startRedraw(tmout) {
      if (this.#redraw_timer) {
         clearTimeout(this.#redraw_timer);
         this.#redraw_timer = undefined;
      }

      if (tmout) {
         this.#redraw_timer = setTimeout(() => this.startRedraw(), tmout);
         return;
      }

      this.#did_update = undefined;

      this.clearDrawings();
      const draw_obj = this.getGeometry(),
            name_prefix = this.#geo_manager ? draw_obj.fName : '';
      return this.prepareObjectDraw(draw_obj, name_prefix);
   }

  /** @summary draw TGeo object */
   static async draw(dom, obj, opt) {
      if (!obj) return null;

      let shape = null, extras = null, extras_path = '', is_eve = false;

      if (('fShapeBits' in obj) && ('fShapeId' in obj)) {
         shape = obj; obj = null;
      } else if ((obj._typename === clTGeoVolumeAssembly) || (obj._typename === clTGeoVolume))
         shape = obj.fShape;
      else if ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract)) {
         shape = obj.fShape; is_eve = true;
      } else if (obj._typename === clTGeoManager)
         shape = obj.fMasterVolume.fShape;
      else if (obj._typename === clTGeoOverlap) {
         extras = obj.fMarker;
         extras_path = '<prnt>/Marker';
         obj = buildOverlapVolume(obj);
         if (!opt) opt = 'wire';
      } else if ('fVolume' in obj) {
         if (obj.fVolume) shape = obj.fVolume.fShape;
      } else
         obj = null;

      if (isStr(opt) && opt.indexOf('comp') === 0 && shape && (shape._typename === clTGeoCompositeShape) && shape.fNode) {
         let maxlvl = 1;
         opt = opt.slice(4);
         if (opt[0] === 'x') { maxlvl = 999; opt = opt.slice(1) + '_vislvl999'; }
         obj = buildCompositeVolume(shape, maxlvl);
      }

      if (!obj && shape)
         obj = Object.assign(create(clTNamed), { _typename: clTEveGeoShapeExtract, fTrans: null, fShape: shape, fRGBA: [0, 1, 0, 1], fElements: null, fRnrSelf: true });

      if (!obj)
         return null;

      // eslint-disable-next-line no-use-before-define
      const painter = createGeoPainter(dom, obj, opt);

      if (painter.ctrl.is_main && !obj.$geo_painter)
         obj.$geo_painter = painter;

      if (!painter.ctrl.is_main && painter.ctrl.project && obj.$geo_painter) {
         painter.assignCentral(obj.$geo_painter);
         obj.$geo_painter.assignSubordinate(painter);
      }

      if (is_eve && (!painter.ctrl.vislevel || (painter.ctrl.vislevel < 9)))
         painter.ctrl.vislevel = 9;

      if (extras) {
         painter.ctrl.split_colors = true;
         painter.addExtra(extras, extras_path);
      }

      return painter.loadMacro(painter.ctrl.script_name).then(arg => painter.prepareObjectDraw(arg.obj, arg.prefix));
   }

} // class TGeoPainter


let add_settings = false;

/** @summary Get icon for the browser
  * @private */
function getBrowserIcon(hitem, hpainter) {
   let icon = '';
   switch (hitem._kind) {
      case getKindForType(clTEveTrack): icon = 'img_evetrack'; break;
      case getKindForType(clTEvePointSet): icon = 'img_evepoints'; break;
      case getKindForType(clTPolyMarker3D): icon = 'img_evepoints'; break;
   }
   if (icon) {
      const drawitem = findItemWithGeoPainter(hitem);
      if (drawitem?._painter?.extraObjectVisible(hpainter, hitem))
         icon += ' geovis_this';
   }
   return icon;
}

/** @summary handle click on browser icon
  * @private */
function browserIconClick(hitem, hpainter) {
   if (hitem._volume) {
      if (hitem._more && hitem._volume.fNodes?.arr?.length)
         toggleGeoBit(hitem._volume, geoBITS.kVisDaughters);
      else
         toggleGeoBit(hitem._volume, geoBITS.kVisThis);

      updateBrowserIcons(hitem._volume, hpainter);

      findItemWithGeoPainter(hitem, true);
      return false; // no need to update icon - we did it ourself
   }

   if (hitem._geoobj && ((hitem._geoobj._typename === clTEveGeoShapeExtract) || (hitem._geoobj._typename === clREveGeoShapeExtract))) {
      hitem._geoobj.fRnrSelf = !hitem._geoobj.fRnrSelf;

      updateBrowserIcons(hitem._geoobj, hpainter);
      findItemWithGeoPainter(hitem, true);
      return false; // no need to update icon - we did it ourself
   }

   // first check that geo painter assigned with the item
   const drawitem = findItemWithGeoPainter(hitem),
         newstate = drawitem?._painter?.extraObjectVisible(hpainter, hitem, true);

   // return true means browser should update icon for the item
   return newstate !== undefined;
}


/** @summary Create geo-related css entries
  * @private */
function injectGeoStyle() {
   if (!add_settings && isFunc(internals.addDrawFunc)) {
      add_settings = true;
      // indication that draw and hierarchy is loaded, create css
      internals.addDrawFunc({ name: clTEvePointSet, icon_get: getBrowserIcon, icon_click: browserIconClick });
      internals.addDrawFunc({ name: clTEveTrack, icon_get: getBrowserIcon, icon_click: browserIconClick });
   }

   function img(name, code) {
      return `.jsroot .img_${name} { display: inline-block; height: 16px; width: 16px; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQ${code}'); }`;
   }

   injectStyle(`
${img('geoarb8', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAAB1SURBVBjTdY6rEYAwEETTy6lzK8/Fo+Jj18dTAjUgaQGfGiggtRDE8RtY93Zu514If2nzk2ux9c5TZkwXbiWTUavzws69oBfpYBrMT4r0Jhsw+QfRgQSw+CaKRsKsnV+SaF8MN49RBSgPUxO85PMl5n4tfGUH2gghs2uPAeQAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geocombi', 'CAQAAAC1+jfqAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJiS0dEAP+Hj8y/AAAACXBIWXMAAABIAAAASABGyWs+AAAAlUlEQVQoz5VQMQ4CMQyzEUNnBqT7Bo+4nZUH8gj+welWJsQDkHoCEYakTXMHSFiq2jqu4xRAEl2A7w4myWzpzCSZRZ658ldKu1hPnFsequBIc/hcLli3l52MAIANtpWrDsv8waGTW6BPuFtsdZArXyFuj33TQpazGEQF38phipnLgItxRcAoOeNpzv4PTXnC42fb//AGI5YqfQAU8dkAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geocone', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACRSURBVBjTdY+xDcNACEVvEm/ggo6Olva37IB0C3iEzJABvAHFTXBDeJRwthMnUvylk44vPjxK+afeokX0flQhJO7L4pafSOMxzaxIKc/Tc7SIjNLyieyZSjBzc4DqMZI0HTMonWPBNlogOLeuewbg9c0hOiIqH7DKmTCuFykjHe4XOzQ58XVMGxzt575tKzd6AX9yMkcWyPlsAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geogtra', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACCSURBVBjTVc+hDQMxDAVQD1FyqCQk0MwsCwQEG3+eCW6B0FvheDboFMGepTlVitPP/Cz5y0S/mNkw8pySU9INJDDH4vM4Usm5OrQXasXtkA+tQF+zxfcDY8EVwgNeiwmA37TEccK5oLOwQtuCj7BM2Fq7iGrxVqJbSsH+GzXs+798AThwKMh3/6jDAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geomedium', 'BAMAAADt3eJSAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAABVQTFRFAAAAAAAAMDAww8PDWKj/////gICAG0/C4AAAAAF0Uk5TAEDm2GYAAAABYktHRAX4b+nHAAAACXBIWXMAAABIAAAASABGyWs+AAAAXElEQVQI102MwRGAMAgEuQ6IDwvQCjQdhAl/H7ED038JHhkd3dcOLAgESFARaAqnEB3yrj6QSEym1RbbOKinN+8q2Esui1GaX7VXSi4RUbxHRbER8X6O5Pg/fLgBBzMN8HfXD3AAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geopara', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAABtSURBVBjTY2DADq5MT7+CzD9kaKjp+QhJYIWqublhMbKAgpOnZxWSQJdsVJTndCSBKoWoAM/VSALpqlEBAYeQBKJAAsi2BGgCBZDdEWUYFZCOLFBlGOWJ7AyGFeaotjIccopageK3R12PGHABACTYHWd0tGw6AAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('georotation', 'CAQAAAC1+jfqAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJiS0dEAP+Hj8y/AAAACXBIWXMAAABIAAAASABGyWs+AAAAiklEQVQoz2NgYGBgYGDg+A/BmIAFIvyDEbs0AwMTAwHACLPiB5QVBTdpGSOSCZjScDcgc4z+32BgYGBgEGIQw3QDLkdCTZD8/xJFeBfDVxQT/j9n/MeIrMCNIRBJwX8GRuzGM/yHKMAljeILNFOuMTyEisEUMKIqucrwB2oyIhyQpH8y/MZrLWkAAHFzIHIc0Q5yAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geotranslation', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAABESURBVBjTY2DgYGAAYzjgAAIQgSLAgSwAAcrWUUCAJBAVhSpgBAQumALGCJPAAsriHIS0IAQ4UAU4cGphQBWwZSAOAADGJBKdZk/rHQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geotrd2', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAABsSURBVBjTbY+xDcAwCARZx6UraiaAmpoRvIIb75PWI2QITxIiRQKk0CCO/xcA/NZ9LRs7RkJEYg3QxczUwoGsXiMAoe8lAelqRWFNKpiNXZLAalRDd0f3TMgeMckABKsCDmu+442RddeHz9cf9jUkW8smGn8AAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geovolume', 'BAMAAADt3eJSAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAB5QTFRFAAAAMDAw///Ay8uc/7+Q/4BgmJh4gIDgAAD/////CZb2ugAAAAF0Uk5TAEDm2GYAAAABYktHRAnx2aXsAAAACXBIWXMAAABIAAAASABGyWs+AAAAR0lEQVQI12NggAEBIBAEQgYGQUYQAyIGIhgwAZMSGCgwMJuEKimFOhswsKWAGG4JDGxJIBk1EEO9o6NIDVkEpgauC24ODAAASQ8Pkj/retYAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geoassembly', 'BAMAAADt3eJSAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAA9QTFRFAAAAMDAw/wAAAAD/////jEo0BQAAAAF0Uk5TAEDm2GYAAAABYktHRASPaNlRAAAACXBIWXMAAABIAAAASABGyWs+AAAAOklEQVQI12NggAFGRgEgEBRgEBSAMhgYGQQEgAR+oARGDIwCIAYjUL0A2DQQg9nY2ABVBKoGrgsDAADxzgNboMz8zQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geocomposite', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAABuSURBVBjTY2AgF2hqgQCCr+0V4O7hFmgCF7CJyKysKkmxhfGNLaw9SppqAi2gfMuY5Agrl+ZaC6iAUXRJZX6Ic0klTMA5urapPFY5NRcmYKFqWl8S5RobBRNg0PbNT3a1dDGH8RlM3LysTRjIBwAG6xrzJt11BAAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geoctub', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACESURBVBjTdc+xDcMwDARA7cKKHTuWX37LHaw+vQbQAJomA7j2DB7FhCMFCZB8pxPwJEv5kQcZW+3HencRBekak4aaMQIi8YJdAQ1CMeE0UBkuaLMETklQ9Alhka0JzzXWqLVBuQYPpWcVuBbZjZafNRYcDk9o/b07bvhINz+/zxu1/M0FSRcmAk/HaIcAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geohype', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACKSURBVBjTbU+rFQQhDKQSDDISEYuMREfHx6eHKMpYuf5qoIQt5bgDblfcuJk3nySEhSvceDV3c/ejT66lspopE9pXyIlkCrHMBACpu1DClekQAREi/loviCnF/NhRwJLaQ6hVhPjB8bOCsjlnNnNl0FWJVWxAqGzHONRHpu5Ml+nQ+8GzNW9n+Is3eg80Nk0iiwoAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geomixture', 'BAMAAADt3eJSAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAACFQTFRFAAAAAAAAKysrVVUA//8B//8AgICAqqpV398gv79A////VYJtlwAAAAF0Uk5TAEDm2GYAAAABYktHRApo0PRWAAAACXBIWXMAAABIAAAASABGyWs+AAAAXklEQVQI12NgwASCQsJCgoZAhoADq1tKIJAhEpDGxpYIZKgxsLElgBhibAkOCY4gKTaGkPRGIEPUIYEBrEaAIY0tDawmgYWNgREkkjCVjRWkWCUhLY0FJCIIBljsBgCZTAykgaRiRwAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geopcon', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACJSURBVBjTdc+hGcQwCIZhhjl/rkgWiECj8XgGyAbZoD5LdIRMkEnKkV575n75Pp8AgLU54dmh6mauelyAL2Qzxfe2sklioq6FacFAcRFXYhwJHdU5rDD2hEYB/CmoJVRMiIJqgtENuoqA8ltAlYAqRH4d1tGkwzTqN2gA7Nv+fUwkgZ/3mg34txM+szzATJS1HQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geosphere', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACFSURBVBjTdY+xEcQwCAQp5QNFjpQ5vZACFBFTADFFfKYCXINzlUAJruXll2ekxDAEt9zcANFbXb2mqm56dxsymAH0yccAJaeNi0h5QGyfxGJmivMPjj0nmLsbRmyFCss3rlbpcUjfS8wLUNRcJyCF6uqg2IvYCnoKC7f1kSbA6riTz7evfwj3Ml+H3KBqAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geotrap', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAAB5SURBVBjTbY+hFYAwDETZB1OJi4yNPp0JqjtAZ2AELL5DdABmIS2PtLxHXH7u7l2W5W+uHMHpGiCHLYR1yw4SCZMIXBOJWVSjK7QDDAu4g8OBmAKK4sAEDdR3rw8YmcUcrEijKKhl7lN1IQPn9ExlgU6/WEyc75+5AYK0KY5oHBDfAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geotubeseg', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACBSURBVBjTdc+hEcQwDARA12P6QFBQ9LDwcXEVkA7SQTr4BlJBakgpsWdsh/wfux3NSCrlV86Mlrxmz1pBWq3bAHwETohxABVmDZADQp1BE+wDNnGywzHgmHDOreJNTDH3Xn3CVX0dpu2MHcIFBkYp/gKsQ8SCQ72V+36/+2aWf3kAQfgshnpXF0wAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geoxtru', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAABcSURBVBjTY2AgEmhpeZV56vmWwQW00QUYwAJlSAI6XmVqukh8PT1bT03PchhXX09Pr9wQIQDiJ+ZowgWAXD3bck+QQDlCQTkDQgCoxA/ERBKwhbDglgA1lDMQDwCc/Rvq8nYsWgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geobbox', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAAB/SURBVBjTVc+hEYAwDAXQLlNRF1tVGxn9NRswQiSSCdgDyQBM0FlIIb2WuL77uf6E8E0N02wKYRwDciTKREVvB04GuZSyOMCABRB1WGzF3uDNQTvs/RcDtJXT4fSEXA5XoiQt0ttVSm8Co2psIOvoimjAOqBmFtH5wEP2373TPIvTK1nrpULXAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geoconeseg', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAAB4SURBVBjTdc6hEcAgDAXQbFNZXHQkFlkd/30myAIMwAws0gmYpVzvoFyv/S5P/B+izzQ387ZA2pkDnvsU1SQLVIFrOM4JFmEaYp2gCQbmPEGODhJ8jt7Am47hwgrzInGAifa/elUZnQLY00iU30BZAV+BWi2VfnIBv1osbHH8jX0AAAAldEVYdGRhdGU6Y3JlYXRlADIwMTUtMTItMDJUMTQ6MjY6MjkrMDE6MDDARtd2AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE0LTExLTEyVDA4OjM5OjE5KzAxOjAwO3ydwwAAAABJRU5ErkJggg==')}
${img('geoeltu', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACGSURBVBjTdY+hFYUwDEU7xq9CIXC4uNjY6KczQXeoYgVMR2ABRmCGjvIp/6dgiEruueedvBDuOR57LQnKyc8CJmKO+N8bieIUPtmBWjIIx8XDBHYCipsnql1g2D0UP2OoDqwBncf+RdZmzFMHizRjog7KZYzawd4Ay93lEAPWR7WAvNbwMl/XwSxBV8qCjgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geomaterial', 'CAQAAAC1+jfqAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJiS0dEAP+Hj8y/AAAACXBIWXMAAABIAAAASABGyWs+AAAAbElEQVQoz62QMRbAIAhDP319Xon7j54qHSyCtaMZFCUkRjgDIdRU9yZUCfg8ut5aAHdcxtoNurmgA3ABNKIR9KimhSukPe2qxcCYC0pfFXx/aFWo7i42KKItOpopqvvnLzJmtlZTS7EfGAfwAM4EQbLIGV0sAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geoparab', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAAB/SURBVBjTbY+xDYAwDAQ9UAp3X7p0m9o9dUZgA9oMwAjpMwMzMAnYBAQSX9mn9+tN9KOtzsWsLOvYCziUGNX3nnCLJRzKPgeYrhPW7FJNLUB3YJazYKQKTnBaxgXRzNmJcrt7XCHQp9kEB1wfELEir/KGj4Foh8A+/zW1nf51AFabKZuWK+mNAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geopgon', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAABwSURBVBjTY2AgDlwAAzh3sX1sPRDEeuwDc+8V2dsHgQQ8LCzq74HkLSzs7Yva2tLt7S3sN4MNiDUGKQmysCi6BzWkzcI+PdY+aDPCljZlj1iFOUjW1tvHLjYuQhJIt5/DcAFZYLH9YnSn7iPST9gAACbsJth21haFAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geotorus', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACGSURBVBjTjY+hFcMwDEQ9SkFggXGIoejhw+LiGkBDlHoAr+AhgjNL5byChuXeE7gvPelUyjOds/f5Zw0ggfj5KVCPMBWeyx+SbQ1XUriAC2XfpWWxjQQEZasRtRHiCUAj3qN4JaolUJppzh4q7dUTdHFXW/tH9OuswWm3nI7tc08+/eGLl758ey9KpKrNOQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('geotrd1', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAAB/SURBVBjTbc6xDQMhDAVQ9qH6lUtal65/zQ5IDMAMmYAZrmKGm4FJzlEQQUo+bvwkG4fwm9lbodV7w40Y4WGfSxQiXiJlQfZOjWRb8Ioi3tKuBQMCo7+9N72BzPsfAuoTdUP9QN8wgOQwvsfWmHzpeT5BKydMNW0nhJGvGf7mAc5WKO9e5N2dAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE1LTEyLTAyVDE0OjI2OjI5KzAxOjAwwEbXdgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNC0xMS0xMlQwODozOToxOSswMTowMDt8ncMAAAAASUVORK5CYII=')}
${img('geotube', 'CAAAAAA6mKC9AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJ0Uk5TAAB2k804AAAAAmJLR0QA/4ePzL8AAAAJcEhZcwAAAEgAAABIAEbJaz4AAACGSURBVBjTRc+tEcAwCAXgLFNbWeSzSDQazw5doWNUZIOM0BEyS/NHy10E30HyklKvWnJ+0le3sJoKn3X2z7GRuvG++YRyMMDt0IIKUXMzxbnugJi5m9K1gNnGBOUFElAWGMaKIKI4xoQggl00gT+A9hXWgDwnfqgsHRAx2m+8bfjfdyrx5AtsSjpwu+M2RgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNS0xMi0wMlQxNDoyNjoyOSswMTowMMBG13YAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTQtMTEtMTJUMDg6Mzk6MTkrMDE6MDA7fJ3DAAAAAElFTkSuQmCC')}
${img('evepoints', 'BAMAAADt3eJSAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAABJQTFRF////n4mJcEdKRDMzcEdH////lLE/CwAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAABIAAAASABGyWs+AAAAI0lEQVQI12NgIAowIpgKEJIZLiAgAKWZGQzQ9UGlWIizBQgAN4IAvGtVrTcAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTYtMDktMDJUMTU6MDQ6MzgrMDI6MDDPyc7hAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE2LTA5LTAyVDE1OjA0OjM4KzAyOjAwvpR2XQAAAABJRU5ErkJggg==')}
${img('evetrack', 'CAQAAAC1+jfqAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAJiS0dEAP+Hj8y/AAAACXBIWXMAAABIAAAASABGyWs+AAAAqElEQVQoz32RMQrCQBBFf4IgSMB0IpGkMpVHCFh7BbHIGTyVhU0K8QYewEKsbVJZaCUiPAsXV8Puzhaz7H8zs5+JUDjikLilQr5zpCRl5xMXZNScQE5gSMGaz70jjUAJcw5c3UBMTsUe+9Kzf065SbropeLXimWfDIgoab/tOyPGzOhz53+oSWcSGh7UdB2ZNKXBZdgAuUdEKJYmrEILyVgG6pE2tEHgDfe42rbjYzSHAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE2LTA5LTAyVDE1OjA0OjQ3KzAyOjAwM0S3EQAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNi0wOS0wMlQxNTowNDo0NyswMjowMEIZD60AAAAASUVORK5CYII=')}
.jsroot .geovis_this { background-color: lightgreen; }
.jsroot .geovis_daughters { background-color: lightblue; }
.jsroot .geovis_all { background-color: yellow; }`);
}


/** @summary Create geo painter
  * @private */
function createGeoPainter(dom, obj, opt) {
   injectGeoStyle();

   geoCfg('GradPerSegm', settings.GeoGradPerSegm);
   geoCfg('CompressComp', settings.GeoCompressComp);

   const painter = new TGeoPainter(dom, obj);

   painter.decodeOptions(opt); // indicator of initialization

   return painter;
}


/** @summary provide menu for geo object
  * @private */
function provideMenu(menu, item, hpainter) {
   if (!item._geoobj) return false;

   const obj = item._geoobj, vol = item._volume,
         iseve = ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract));

   if (!vol && !iseve)
      return false;

   menu.separator();

   const scanEveVisible = (obj2, arg, skip_this) => {
      if (!arg) arg = { visible: 0, hidden: 0 };

      if (!skip_this) {
         if (arg.assign !== undefined)
            obj2.fRnrSelf = arg.assign;
         else if (obj2.fRnrSelf)
            arg.vis++;
         else
            arg.hidden++;
      }

      if (obj2.fElements) {
         for (let n = 0; n < obj2.fElements.arr.length; ++n)
            scanEveVisible(obj2.fElements.arr[n], arg, false);
      }

      return arg;
   }, toggleEveVisibility = arg => {
      if (arg === 'self') {
         obj.fRnrSelf = !obj.fRnrSelf;
         item._icon = item._icon.split(' ')[0] + provideVisStyle(obj);
         hpainter.updateTreeNode(item);
      } else {
         scanEveVisible(obj, { assign: (arg === 'true') }, true);
         hpainter.forEachItem(m => {
            // update all child items
            if (m._geoobj && m._icon) {
               m._icon = item._icon.split(' ')[0] + provideVisStyle(m._geoobj);
               hpainter.updateTreeNode(m);
            }
         }, item);
      }

      findItemWithGeoPainter(item, true);
   }, toggleMenuBit = arg => {
      toggleGeoBit(vol, arg);
      const newname = item._icon.split(' ')[0] + provideVisStyle(vol);
      hpainter.forEachItem(m => {
         // update all items with that volume
         if (item._volume === m._volume) {
            m._icon = newname;
            hpainter.updateTreeNode(m);
         }
      });

      hpainter.updateTreeNode(item);
      findItemWithGeoPainter(item, true);
   }, drawitem = findItemWithGeoPainter(item),
      fullname = drawitem ? hpainter.itemFullName(item, drawitem) : '';

   if ((item._geoobj._typename.indexOf(clTGeoNode) === 0) && drawitem) {
      menu.add('Focus', () => {
        if (drawitem && isFunc(drawitem._painter?.focusOnItem))
           drawitem._painter.focusOnItem(fullname);
      });
   }

   if (iseve) {
      menu.addchk(obj.fRnrSelf, 'Visible', 'self', toggleEveVisibility);
      const res = scanEveVisible(obj, undefined, true);
      if (res.hidden + res.visible > 0)
         menu.addchk((res.hidden === 0), 'Daughters', res.hidden ? 'true' : 'false', toggleEveVisibility);
   } else {
      const stack = drawitem?._painter?.getClones()?.findStackByName(fullname),
            phys_vis = stack ? drawitem._painter.getClones().getPhysNodeVisibility(stack) : null,
            is_visible = testGeoBit(vol, geoBITS.kVisThis);

      menu.addchk(testGeoBit(vol, geoBITS.kVisNone), 'Invisible', geoBITS.kVisNone, toggleMenuBit);
      if (stack) {
         const changePhysVis = arg => {
            drawitem._painter.getClones().setPhysNodeVisibility(stack, (arg === 'off') ? false : arg);
            findItemWithGeoPainter(item, true);
         };

         menu.sub('Physical vis', 'Physical node visibility - only for this instance');
         menu.addchk(phys_vis?.visible, 'on', 'on', changePhysVis, 'Enable visibility of phys node');
         menu.addchk(phys_vis && !phys_vis.visible, 'off', 'off', changePhysVis, 'Disable visibility of physical node');
         menu.add('reset', 'clear', changePhysVis, 'Reset custom visibility of physical node');
         menu.add('reset all', 'clearall', changePhysVis, 'Reset all custom settings for all nodes');
         menu.endsub();
      }

      menu.addchk(is_visible, 'Logical vis',
            geoBITS.kVisThis, toggleMenuBit, 'Logical node visibility - all instances');
      menu.addchk(testGeoBit(vol, geoBITS.kVisDaughters), 'Daughters',
            geoBITS.kVisDaughters, toggleMenuBit, 'Logical node daugthers visibility');
   }

   return true;
}

let createItem = null;

/** @summary create list entity for geo object
  * @private */
function createList(parent, lst, name, title) {
   if (!lst?.arr?.length)
      return;

   const list_item = {
      _name: name,
      _kind: getKindForType(clTList),
      _title: title,
      _more: true,
      _geoobj: lst,
      _parent: parent,
      _get(item /* , itemname */) {
         return Promise.resolve(item._geoobj || null);
      },
      _expand(node, lst2) {
         // only childs

         if (lst2.fVolume)
            lst2 = lst2.fVolume.fNodes;

         if (!lst2.arr)
            return false;

         node._childs = [];

         checkDuplicates(null, lst2.arr);

         for (const n in lst2.arr)
            createItem(node, lst2.arr[n]);

         return true;
      }
   };

   if (!parent._childs)
      parent._childs = [];
   parent._childs.push(list_item);
}


/** @summary Expand geo object
  * @private */
function expandGeoObject(parent, obj) {
   injectGeoStyle();

   if (!parent || !obj) return false;

   const isnode = (obj._typename.indexOf(clTGeoNode) === 0),
         isvolume = (obj._typename.indexOf(clTGeoVolume) === 0),
         ismanager = (obj._typename === clTGeoManager),
         iseve = ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract)),
         isoverlap = (obj._typename === clTGeoOverlap);

   if (!isnode && !isvolume && !ismanager && !iseve && !isoverlap) return false;

   if (parent._childs) return true;

   if (ismanager) {
      createList(parent, obj.fMaterials, 'Materials', 'list of materials');
      createList(parent, obj.fMedia, 'Media', 'list of media');
      createList(parent, obj.fTracks, 'Tracks', 'list of tracks');
      createList(parent, obj.fOverlaps, 'Overlaps', 'list of detected overlaps');
      createItem(parent, obj.fMasterVolume);
      return true;
   }

   if (isoverlap) {
      createItem(parent, obj.fVolume1);
      createItem(parent, obj.fVolume2);
      createItem(parent, obj.fMarker, 'Marker');
      return true;
   }

   let volume, subnodes, shape;

   if (iseve) {
      subnodes = obj.fElements?.arr;
      shape = obj.fShape;
   } else {
      volume = isnode ? obj.fVolume : obj;
      subnodes = volume?.fNodes?.arr;
      shape = volume?.fShape;
   }

   if (!subnodes && (shape?._typename === clTGeoCompositeShape) && shape?.fNode) {
      if (!parent._childs) {
         createItem(parent, shape.fNode.fLeft, 'Left');
         createItem(parent, shape.fNode.fRight, 'Right');
      }

      return true;
   }

   if (!subnodes)
      return false;

   checkDuplicates(obj, subnodes);

   for (let i = 0; i < subnodes.length; ++i)
      createItem(parent, subnodes[i]);

   return true;
}


/** @summary create hierarchy item for geo object
  * @private */
createItem = function(node, obj, name) {
   const sub = {
      _kind: getKindForType(obj._typename),
      _name: name || getObjectName(obj),
      _title: obj.fTitle,
      _parent: node,
      _geoobj: obj,
      _get(item /* ,itemname */) {
          // mark object as belong to the hierarchy, require to
          if (item._geoobj) item._geoobj.$geoh = true;
          return Promise.resolve(item._geoobj);
      }
   };
   let volume, shape, subnodes, iseve = false;

   if (obj._typename === 'TGeoMaterial')
      sub._icon = 'img_geomaterial';
   else if (obj._typename === 'TGeoMedium')
      sub._icon = 'img_geomedium';
   else if (obj._typename === 'TGeoMixture')
      sub._icon = 'img_geomixture';
   else if ((obj._typename.indexOf(clTGeoNode) === 0) && obj.fVolume) {
      sub._title = 'node:' + obj._typename;
      if (obj.fTitle) sub._title += ' ' + obj.fTitle;
      volume = obj.fVolume;
   } else if (obj._typename.indexOf(clTGeoVolume) === 0)
      volume = obj;
   else if ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract)) {
      iseve = true;
      shape = obj.fShape;
      subnodes = obj.fElements ? obj.fElements.arr : null;
   } else if ((obj.fShapeBits !== undefined) && (obj.fShapeId !== undefined))
      shape = obj;

   if (volume) {
      shape = volume.fShape;
      subnodes = volume.fNodes ? volume.fNodes.arr : null;
   }

   if (volume || shape || subnodes) {
      if (volume) sub._volume = volume;

      if (subnodes) {
         sub._more = true;
         sub._expand = expandGeoObject;
      } else if (shape && (shape._typename === clTGeoCompositeShape) && shape.fNode) {
         sub._more = true;
         sub._shape = shape;
         sub._expand = function(node2 /* , obj */) {
            createItem(node2, node2._shape.fNode.fLeft, 'Left');
            createItem(node2, node2._shape.fNode.fRight, 'Right');
            return true;
         };
      }

      if (!sub._title && (obj._typename !== clTGeoVolume))
         sub._title = obj._typename;

      if (shape) {
         if (sub._title === '')
            sub._title = shape._typename;

         sub._icon = getShapeIcon(shape);
      } else
         sub._icon = sub._more ? 'img_geocombi' : 'img_geobbox';

      if (volume)
         sub._icon += provideVisStyle(volume);
      else if (iseve)
         sub._icon += provideVisStyle(obj);

      sub._menu = provideMenu;
      sub._icon_click = browserIconClick;
   }

   if (!node._childs)
      node._childs = [];

   if (!sub._name) {
      if (isStr(node._name)) {
         sub._name = node._name;
         if (sub._name.at(-1) === 's')
            sub._name = sub._name.slice(0, sub._name.length - 1);
         sub._name += '_' + node._childs.length;
      } else
         sub._name = 'item_' + node._childs.length;
   }

   node._childs.push(sub);

   return sub;
};

/** @summary Draw dummy geometry
  * @private */
async function drawDummy3DGeom(painter) {
   const shape = create(clTNamed);
   shape._typename = clTGeoBBox;
   shape.fDX = 1e-10;
   shape.fDY = 1e-10;
   shape.fDZ = 1e-10;
   shape.fShapeId = 1;
   shape.fShapeBits = 0;
   shape.fOrigin = [0, 0, 0];

   const obj = Object.assign(create(clTNamed),
                { _typename: clTEveGeoShapeExtract,
                  fTrans: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
                  fShape: shape, fRGBA: [0, 0, 0, 0], fElements: null, fRnrSelf: false }),
         pp = painter.getPadPainter(),
         pad = pp?.getRootPad(true),
         opt = 'dummy;' + (pad?.fFillColor && (pad?.fFillStyle > 1000) ? 'bkgr_' + pad.fFillColor : '');

   return TGeoPainter.draw(pp || painter.getDom(), obj, opt);
}

/** @summary Direct draw function for TAxis3D
  * @private */
function drawAxis3D() {
   const main = this.getMainPainter();

   if (isFunc(main?.setAxesDraw))
      return main.setAxesDraw(true);

   console.error('no geometry painter found to toggle TAxis3D drawing');
}

/** @summary Build three.js model for given geometry object
  * @param {Object} obj - TGeo-related object
  * @param {Object} [opt] - options
  * @param {Number} [opt.vislevel] - visibility level like TGeoManager, when not specified - show all
  * @param {Number} [opt.numnodes=1000] - maximal number of visible nodes
  * @param {Number} [opt.numfaces=100000] - approx maximal number of created triangles
  * @param {Number} [opt.instancing=-1] - <0 disable use of InstancedMesh, =0 only for large geometries, >0 enforce usage of InstancedMesh
  * @param {boolean} [opt.doubleside=false] - use double-side material
  * @param {boolean} [opt.wireframe=false] - show wireframe for created shapes
  * @param {boolean} [opt.transparency=0] - make nodes transparent
  * @param {boolean} [opt.dflt_colors=false] - use default ROOT colors
  * @param {boolean} [opt.set_names=true] - set names to all Object3D instances
  * @param {boolean} [opt.set_origin=false] - set TGeoNode/TGeoVolume as Object3D.userData
  * @return {object} Object3D with created model
  * @example
  * import { build } from 'https://root.cern/js/latest/modules/geom/TGeoPainter.mjs';
  * let obj3d = build(obj);
  * // this is three.js object and can be now inserted in the scene
  */
function build(obj, opt) {
   if (!obj) return null;

   if (!opt) opt = {};
   if (!opt.numfaces) opt.numfaces = 100000;
   if (!opt.numnodes) opt.numnodes = 1000;
   if (!opt.frustum) opt.frustum = null;

   opt.res_mesh = opt.res_faces = 0;

   if (opt.instancing === undefined)
      opt.instancing = -1;

   opt.info = { num_meshes: 0, num_faces: 0 };

   let clones, visibles;

   if (obj.visibles && obj.nodes && obj.numnodes) {
      // case of draw message from geometry viewer

      const nodes = obj.numnodes > 1e6 ? { length: obj.numnodes } : new Array(obj.numnodes);

      obj.nodes.forEach(node => {
         nodes[node.id] = ClonedNodes.formatServerElement(node);
      });

      clones = new ClonedNodes(null, nodes);
      clones.name_prefix = clones.getNodeName(0);

      // normally only need when making selection, not used in geo viewer
      // this.geo_clones.setMaxVisNodes(draw_msg.maxvisnodes);
      // this.geo_clones.setVisLevel(draw_msg.vislevel);
      // TODO: provide from server
      clones.maxdepth = 20;

      const nsegm = obj.cfg?.nsegm || 30;

      for (let cnt = 0; cnt < obj.visibles.length; ++cnt) {
         const item = obj.visibles[cnt], rd = item.ri;

         // entry may be provided without shape - it is ok
         if (rd)
            item.server_shape = rd.server_shape = createServerGeometry(rd, nsegm);
      }

      visibles = obj.visibles;
   } else {
      let shape = null, hide_top = false;

      if (('fShapeBits' in obj) && ('fShapeId' in obj)) {
         shape = obj; obj = null;
      } else if ((obj._typename === clTGeoVolumeAssembly) || (obj._typename === clTGeoVolume))
         shape = obj.fShape;
       else if ((obj._typename === clTEveGeoShapeExtract) || (obj._typename === clREveGeoShapeExtract))
         shape = obj.fShape;
       else if (obj._typename === clTGeoManager) {
         obj = obj.fMasterVolume;
         hide_top = !opt.showtop;
         shape = obj.fShape;
      } else if (obj.fVolume)
         shape = obj.fVolume.fShape;
       else
         obj = null;


      if (opt.composite && shape && (shape._typename === clTGeoCompositeShape) && shape.fNode)
         obj = buildCompositeVolume(shape);

      if (!obj && shape)
         obj = Object.assign(create(clTNamed), { _typename: clTEveGeoShapeExtract, fTrans: null, fShape: shape, fRGBA: [0, 1, 0, 1], fElements: null, fRnrSelf: true });

      if (!obj) return null;

      if (obj._typename.indexOf(clTGeoVolume) === 0)
         obj = { _typename: clTGeoNode, fVolume: obj, fName: obj.fName, $geoh: obj.$geoh, _proxy: true };

      clones = new ClonedNodes(obj);
      clones.setVisLevel(opt.vislevel);
      clones.setMaxVisNodes(opt.numnodes);

      if (opt.dflt_colors)
         clones.setDefaultColors(true);

      const uniquevis = opt.no_screen ? 0 : clones.markVisibles(true);
      if (uniquevis <= 0)
         clones.markVisibles(false, false, hide_top);
      else
         clones.markVisibles(true, true, hide_top); // copy bits once and use normal visibility bits

      clones.produceIdShifts();

      // collect visible nodes
      const res = clones.collectVisibles(opt.numfaces, opt.frustum);

      visibles = res.lst;
   }

   if (!opt.material_kind)
      opt.material_kind = 'lambert';
   if (opt.set_names === undefined)
      opt.set_names = true;

   clones.setConfig(opt);

   // collect shapes
   const shapes = clones.collectShapes(visibles);

   clones.buildShapes(shapes, opt.numfaces);

   const toplevel = new THREE.Object3D();
   toplevel.clones = clones; // keep reference on JSROOT data

   const colors = getRootColors();

   if (clones.createInstancedMeshes(opt, toplevel, visibles, shapes, colors))
      return toplevel;

   for (let n = 0; n < visibles.length; ++n) {
      const entry = visibles[n];
      if (entry.done) continue;

      const shape = entry.server_shape || shapes[entry.shapeid];
      if (!shape.ready) {
         console.warn('shape marked as not ready when it should');
         break;
      }

      clones.createEntryMesh(opt, toplevel, entry, shape, colors);
   }

   return toplevel;
}

export { ClonedNodes, build, TGeoPainter, GeoDrawingControl,
         expandGeoObject, createGeoPainter, drawAxis3D, drawDummy3DGeom, produceRenderOrder };
