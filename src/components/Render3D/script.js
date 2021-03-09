import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkGlyph3DMapper from 'vtk.js/Sources/Rendering/Core/Glyph3DMapper';
import vtkLookupTable from 'vtk.js/Sources/Common/Core/LookupTable';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkSphereSource from 'vtk.js/Sources/Filters/Sources/SphereSource';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkOpenGLHardwareSelector from 'vtk.js/Sources/Rendering/OpenGL/HardwareSelector';
import { FieldAssociations } from 'vtk.js/Sources/Common/DataModel/DataSet/Constants';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkInteractorStyleTrackballCamera from 'vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera';
import { ColorMode, ScalarMode } from 'vtk.js/Sources/Rendering/Core/Mapper/Constants';

import State from '@/data/state';

const SPHERE_RESOLUTION = 32;

export default {
  name: 'Render3D',
  props: {
    state: {
      type: State,
      required: true,
    },
  },
  data() {
      return {
        activeDataSet: null,
      };
  },
  computed: {
    geometry() {
      return this.state.geometry;
    },
    spore() {
      return this.state.spore;
    },
    macrophage() {
      return this.state.macrophage;
    },
    neutrophil() {
      return this.state.neutrophil;
    },
    activeType() {
      if (this.activeDataSet === this.spore) {
        return 'A. fumigatus';
      }
      if (this.activeDataSet === this.macrophage) {
        return 'macrophage';
      }
      if (this.activeDataSet === this.neutrophil) {
        return 'neutrophil';
      }
      return '';
    },
  },
  watch: {
    state() {
      this.setStateData();
    },
  },
  beforeDestroy() {
    this.vtk.interactor.unbindEvents();
    this.vtk.openglRenderWindow.delete();
    delete window.vtk;
  },
  created() {
    const renderWindow = vtkRenderWindow.newInstance();
    const renderer = vtkRenderer.newInstance({ background: [0.2, 0.3, 0.4] });
    renderWindow.addRenderer(renderer);
    const interactor = vtkRenderWindowInteractor.newInstance();

    const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
    renderWindow.addView(openglRenderWindow);

    interactor.setView(openglRenderWindow);
    interactor.initialize();
    interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

    const selector = vtkOpenGLHardwareSelector.newInstance();
    selector.setFieldAssociation(FieldAssociations.FIELD_ASSOCIATION_POINTS);
    selector.attach(openglRenderWindow, renderer);

    this.vtk = {
        renderWindow,
        renderer,
        interactor,
        openglRenderWindow,
        selector,
        //
        selected: {},
    };

    // Expose to windows
    window.vtk = this.vtk;

    // map methods to vue component
    this.render = this.vtk.renderWindow.render;
    this.resetCamera = renderer.resetCamera;
    this.updateSize = () => {
        const container = this.$refs.vtkContainer;
        if (container) {
            const { width, height } = container.getBoundingClientRect();
            openglRenderWindow.setSize(width, height);
        }
    };
  },
  mounted() {
    const container = this.$refs.vtkContainer;
    this.vtk.openglRenderWindow.setContainer(container);
    this.vtk.interactor.bindEvents(container);

    this.createGeometry();
    this.createSpore();
    this.createMacrophage();
    this.createNeutrophil();
    this.setStateData();

    this.vtk.renderWindow
        .getInteractor()
        .onLeftButtonPress((evt) => this.onLeftClick(evt));
    this.updateSize();
    this.resetCamera();
    this.render();
  },
  methods: {
    pick(x, y) {
        // Reset previous activeDataSet
        if (this.activeDataSet) {
            const scaleArray = this.activeDataSet.getPointData().getArray('scale');
            scaleArray.getData().fill(1);
            scaleArray.modified();
            this.activeDataSet.modified();
            this.activeDataSet = null;
        }

        // Prevent volume rendering picking
        this.vtk.geometryActor.setVisibility(false);

        // Hardware selection picking
        this.vtk.selector.setArea(x, y, x, y);
        this.vtk.selector.releasePixBuffers();
        const ok = this.vtk.selector.captureBuffers();
        if (ok) {
            const selection = this.vtk.selector.generateSelection(x, y, x, y);
            if (selection && selection.length) {
                const { compositeID, prop } = selection[0].getProperties();
                const ds = prop.getMapper().getInputData();
                const scaleArray = ds.getPointData().getArray('scale');
                if (scaleArray) {
                    scaleArray.getData()[compositeID] = 10; // Pick scale to be x10
                    scaleArray.modified();
                    ds.modified();
                } else {
                    console.log('no scale array');
                }
                this.activeDataSet = ds;
                const info = ds.getPointData().getArrays().map((a) => {
                  const name = a.getName();
                  let value = a.getData()[compositeID];
                  return [
                    name,
                    value,
                  ];
                });

                this.$emit('point', Object.fromEntries([['id', compositeID], ['type', this.activeType], ...info]));
            }
        }

        // Make sure the volume is still visible for std rendering
        this.vtk.geometryActor.setVisibility(true);
    },
    onLeftClick(evt) {
      if (evt.pokedRenderer !== this.vtk.renderer) {
        return;
      }
      const { position: {x, y} } = evt;
      this.pick(x, y);
    },
    setStateData() {
      this.vtk.geometryMapper.setInputData(this.geometry);
      this.spore.getPointData().setActiveScalars('status');
      this.vtk.sporeMapper.setInputData(this.spore);
      this.macrophage.getPointData().setActiveScalars('dead');
      this.vtk.macrophageMapper.setInputData(this.macrophage);
      this.neutrophil.getPointData().setActiveScalars('dead');
      this.vtk.neutrophilMapper.setInputData(this.neutrophil);
      this.render();
    },
    createGeometry() {
      this.vtk.geometryMapper = vtkVolumeMapper.newInstance();
      this.vtk.geometryMapper.setSampleDistance(1.1);

      this.vtk.geometryActor = vtkVolume.newInstance();
      this.vtk.geometryActor.setMapper(this.vtk.geometryMapper);

      // create color and opacity transfer functions
      const ctfun = vtkColorTransferFunction.newInstance();
      const ofun = vtkPiecewiseFunction.newInstance();
      // AIR = 0
      ctfun.addRGBPoint(0, 0.0, 0.0, 0.0);
      ofun.addPoint(0, 0.0);
      // BLOOD = 1
      ctfun.addRGBPoint(0.9, 1.0, 0.0, 0.0);
      ofun.addPoint(0.5, 0.0);
      ctfun.addRGBPoint(1, 1.0, 0.0, 0.0);
      ofun.addPoint(1, 0.05);
      ctfun.addRGBPoint(1.1, 1.0, 0.0, 0.0);
      ofun.addPoint(1.5, 0.0);
      // REGULAR_TISSUE = 2
      ctfun.addRGBPoint(2, 1.0, 0.8, 0.8);
      ofun.addPoint(2, 0.00);
      // EPITHELIUM = 3
      ctfun.addRGBPoint(2.5, 1.0, 0.8, 0.8);
      ofun.addPoint(2.5, 0.00);
      ctfun.addRGBPoint(3, 0.9, 0.9, 1.0);
      ofun.addPoint(3, 0.05);
      ctfun.addRGBPoint(3.5, 1.0, 0.8, 0.8);
      ofun.addPoint(3.5, 0.00);

      this.vtk.geometryActor.getProperty().setRGBTransferFunction(0, ctfun);
      this.vtk.geometryActor.getProperty().setScalarOpacity(0, ofun);
      // TODO: setInterpolationTypeToNearest should be more precise, since scalars are discrete
      this.vtk.geometryActor.getProperty().setInterpolationTypeToLinear();
      this.vtk.geometryActor.getProperty().setUseGradientOpacity(0, false);

      this.vtk.renderer.addVolume(this.vtk.geometryActor);
    },
    createSpore() {
      this.vtk.sporeGlyphSource = vtkSphereSource.newInstance({
        thetaResolution: SPHERE_RESOLUTION,
        phiResolution: SPHERE_RESOLUTION,
      });

      this.vtk.sporeMapper = vtkGlyph3DMapper.newInstance({
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE,
        scaleArray: 'scale',
        scaleFactor: 5,
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
      });
      this.vtk.sporeMapper.setColorByArrayName('status');
      this.vtk.sporeMapper.setInputConnection(this.vtk.sporeGlyphSource.getOutputPort(), 1);

      // I'm not sure why you do that for?
      this.vtk.sporeLookupTable = vtkLookupTable.newInstance({
        numberOfColors: 1,
        hueRange: [0.3],
      });
      this.vtk.sporeMapper.setLookupTable(this.vtk.sporeLookupTable);

      this.vtk.sporeActor = vtkActor.newInstance();
      this.vtk.sporeActor.setMapper(this.vtk.sporeMapper);

      this.vtk.renderer.addActor(this.vtk.sporeActor);
    },
    createMacrophage() {
      this.vtk.macrophageGlyphSource = vtkSphereSource.newInstance({
        thetaResolution: SPHERE_RESOLUTION,
        phiResolution: SPHERE_RESOLUTION,
      });

      this.vtk.macrophageMapper = vtkGlyph3DMapper.newInstance({
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE,
        scaleArray: 'scale',
        scaleFactor: 8,
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
        scalarRange: [0, 1],
      });
      this.vtk.macrophageMapper
        .setInputConnection(this.vtk.macrophageGlyphSource.getOutputPort(), 1);

      // I'm not sure why you do that for?
      this.vtk.macrophageLookupTable = vtkLookupTable.newInstance({
        numberOfColors: 1,
        hueRange: [0.6],
      });
      this.vtk.macrophageMapper.setLookupTable(this.vtk.macrophageLookupTable);

      this.vtk.macrophageActor = vtkActor.newInstance();
      this.vtk.macrophageActor.getProperty().setColor(253 / 255, 98 / 255, 132 / 255);
      this.vtk.macrophageActor.setMapper(this.vtk.macrophageMapper);

      // TODO: Rendering can be disabled here
      this.vtk.renderer.addActor(this.vtk.macrophageActor);
    },
    createNeutrophil() {
      this.vtk.neutrophilGlyphSource = vtkSphereSource.newInstance({
        thetaResolution: SPHERE_RESOLUTION,
        phiResolution: SPHERE_RESOLUTION,
      });

      this.vtk.neutrophilMapper = vtkGlyph3DMapper.newInstance({
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_MAGNITUDE,
        scaleArray: 'scale',
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
      });
      this.vtk.neutrophilMapper.setColorByArrayName('granule_count');
      this.vtk.neutrophilMapper
        .setInputConnection(this.vtk.neutrophilGlyphSource.getOutputPort(), 1);

      // I'm not sure why you do that for?
      this.vtk.neutrophilLookupTable = vtkLookupTable.newInstance({
        numberOfColors: 1,
        hueRange: [0.7], // TODO: (ACK) what color is this anyway?
      });
      this.vtk.neutrophilMapper.setLookupTable(this.vtk.neutrophilLookupTable);

      this.vtk.neutrophilActor = vtkActor.newInstance();
      this.vtk.neutrophilActor.setMapper(this.vtk.neutrophilMapper);

      // TODO: Rendering can be disabled here
      this.vtk.renderer.addActor(this.vtk.neutrophilActor);
    },

    resize() {
      this.$nextTick(this.updateSize);
    },
  },
};