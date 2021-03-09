<template>
  <div
    class="render3d"
  >
    <div
      ref="vtkContainer"
      class="render3d"
    />
  </div>
</template>

<script>
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkGlyph3DMapper from 'vtk.js/Sources/Rendering/Core/Glyph3DMapper';
import vtkLookupTable from 'vtk.js/Sources/Common/Core/LookupTable';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkPointPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';
import vtkSphereSource from 'vtk.js/Sources/Filters/Sources/SphereSource';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import {
  ColorMode,
  ScalarMode,
} from 'vtk.js/Sources/Rendering/Core/Mapper/Constants';

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
  },
  watch: {
    state() {
      this.setStateData();
    },
  },
  beforeDestroy() {
    this.removeSelected();
    delete window.vtk;
    // force delete the webgl context when destroying the component
    const rw = this.vtk.renderWindow;
    if (rw) {
      rw.getInteractor().unbindEvents();
      const gl = this.$el.querySelector('canvas').getContext('webgl2');
      gl.getExtension('WEBGL_lose_context').loseContext();
    }
  },
  mounted() {
    this.vtk = {};
    window.vtk = this.vtk;
    this.vtk.renderWindowContainer = vtkFullScreenRenderWindow.newInstance({
      rootContainer: this.$refs.vtkContainer,
      containerStyle: {
        width: '100%',
        height: '100%',
      },
    });

    this.vtk.selected = {};
    this.vtk.renderer = this.vtk.renderWindowContainer.getRenderer();
    this.vtk.renderWindow = this.vtk.renderWindowContainer.getRenderWindow();

    this.createGeometry();
    this.createSpore();
    this.createMacrophage();
    this.createNeutrophil();
    this.setStateData();

    this.vtk.picker = vtkPointPicker.newInstance({
      tolerance: 0.01,
    });
    this.vtk.renderWindow.getInteractor()
      .onLeftButtonPress((evt) => this.onLeftClick(evt));
    this.vtk.renderer.resetCamera();
    this.render();
  },
  methods: {
    selectedPoint(center) {
      const source = vtkSphereSource.newInstance({
        thetaResolution: SPHERE_RESOLUTION,
        phiResolution: SPHERE_RESOLUTION,
      });
      source.setCenter(center);
      source.setRadius(6);
      const actor = vtkActor.newInstance();
      const mapper = vtkMapper.newInstance();

      mapper.setInputData(source.getOutputData());
      actor.setMapper(mapper);
      actor.getProperty().setColor(0, 0, 0);

      return {
        source,
        actor,
        mapper,
      };
    },
    removeSelected() {
      if (!this.vtk.selected.actor) {
        return;
      }
      this.vtk.renderer.removeActor(this.vtk.selected.actor);
      this.vtk.selected = {};
    },
    onLeftClick(evt) {
      if (evt.pokedRenderer !== this.vtk.renderer) {
        return;
      }

      const { position } = evt;
      const point = [position.x, position.y, 0.0];
      this.vtk.picker.pick(point, this.vtk.renderer);
      this.removeSelected();

      if (!this.vtk.picker.getActors().length) {
        return;
      }

      const [actor] = this.vtk.picker.getActors();
      const pointId = this.vtk.picker.getPointId();
      if (pointId < 0) {
        return;
      }
      const mapper = actor.getMapper();
      const pointData = mapper.getInputData().getPointData();

      this.vtk.selected = this.selectedPoint(
        mapper.getInputData().getPoints().getTuple(pointId),
      );
      this.vtk.renderer.addActor(this.vtk.selected.actor);

      const info = pointData.getArrays().map((a) => {
        const name = a.getName();
        let value = a.getTuple(pointId);
        if (value.length === 1) {
          [value] = value;
        }
        return [
          name,
          value,
        ];
      });
      let type = null;
      if (pointData === this.spore.getPointData()) {
        type = 'A. fumigatus';
      } else if (pointData === this.macrophage.getPointData()) {
        type = 'macrophage';
      } else if (pointData === this.neutrophil.getPointData()) {
        type = 'neutrophil';
      }
      this.$emit('point', Object.fromEntries([['id', pointId], ['type', type], ...info]));
    },
    setStateData() {
      this.vtk.geometryMapper.setInputData(this.geometry);
      this.spore.getPointData().setActiveScalars('status');
      this.vtk.sporeMapper.setInputData(this.spore, 0);
      this.macrophage.getPointData().setActiveScalars('dead');
      this.vtk.macrophageMapper.setInputData(this.macrophage, 0);
      this.neutrophil.getPointData().setActiveScalars('dead');
      this.vtk.neutrophilMapper.setInputData(this.neutrophil, 0);
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
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_CONSTANT,
        scaleFactor: 5,
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
      });
      this.vtk.sporeMapper.setColorByArrayName('status');
      this.vtk.sporeMapper.setInputConnection(this.vtk.sporeGlyphSource.getOutputPort(), 1);

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
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_CONSTANT,
        scaleFactor: 8,
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
        scalarRange: [0, 1],
      });
      this.vtk.macrophageMapper
        .setInputConnection(this.vtk.macrophageGlyphSource.getOutputPort(), 1);

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
        scaleMode: vtkGlyph3DMapper.ScaleModes.SCALE_BY_CONSTANT,
        scaleFactor: 5,
        colorMode: ColorMode.MAP_SCALARS,
        scalarMode: ScalarMode.USE_POINT_FIELD_DATA,
      });
      this.vtk.neutrophilMapper.setColorByArrayName('granule_count');
      this.vtk.neutrophilMapper
        .setInputConnection(this.vtk.neutrophilGlyphSource.getOutputPort(), 1);

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
    render() {
      this.vtk.renderWindow.render();
    },
    resize() {
      this.$nextTick().then(() => {
        if (this.vtk && this.vtk.renderWindowContainer) {
          this.vtk.renderWindowContainer.resize();
        }
      });
    },
  },
};
</script>

<style scoped>
.render3d {
  height: 100vh;
}
</style>
