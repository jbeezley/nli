import vtkXMLImageDataReader from 'vtk.js/Sources/IO/XML/XMLImageDataReader';
import vtkXMLPolyDataReader from 'vtk.js/Sources/IO/XML/XMLPolyDataReader';

import http from '@/http';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

class State {
  constructor(time, geometry, spore, macrophage, neutrophil) {
    this.time = time;
    this.geometry = State.loadImageData(geometry);
    this.spore = State.loadPolyData(spore);
    this.macrophage = State.loadPolyData(macrophage);
    this.neutrophil = State.loadPolyData(neutrophil);
  }

  static async load(id) {
    const [time, geometry, spore, macrophage, neutrophil] = await Promise.all([
      State.getTime(id),
      State.loadFile(id, 'geometry_001.vti'),
      State.loadFile(id, 'spore_001.vtp'),
      State.loadFile(id, 'macrophage_001.vtp'),
      State.loadFile(id, 'neutrophil_001.vtp'),
    ]);
    return new State(time, geometry, spore, macrophage, neutrophil);
  }

  static async getTime(folderId) {
    const folder = await http.get(`folder/${folderId}`);
    return folder.data.meta.time || null;
  }

  static async loadFile(folderId, name) {
    let item;
    let file;
    try {
      [item] = (await http.get('item', {
        params: {
          folderId,
          name,
          limit: 1,
        },
      })).data;
    } catch (e) {
      console.error(`Error loading items from ${folderId}`); // eslint-disable-line no-console
      throw e;
    }
    try {
      [file] = (await http.get(`item/${item._id}/files`, {
        params: {
          limit: 1,
        },
      })).data;
    } catch (e) {
      console.error(`Error loading files from ${item._id}`); // eslint-disable-line no-console
      throw e;
    }
    try {
      return (await http.get(`file/${file._id}/download`, {
        responseType: 'arraybuffer',
      })).data;
    } catch (e) {
      console.error(`Error loading data from ${file._id}`); // eslint-disable-line no-console
      throw e;
    }
  }

  static loadImageData(buffer) {
    const imageDataReader = vtkXMLImageDataReader.newInstance();
    const success = imageDataReader.parseAsArrayBuffer(buffer);
    if (!success) {
      throw new Error('Could not load image data');
    }
    return imageDataReader.getOutputData(0);
  }

  static loadPolyData(buffer) {
    const polyDataReader = vtkXMLPolyDataReader.newInstance();
    const success = polyDataReader.parseAsArrayBuffer(buffer);
    if (!success) {
      throw new Error('Could not load poyy data');
    }
    const ds = polyDataReader.getOutputData(0);
    const values = new Uint8Array(ds.getNumberOfPoints());
    values.fill(1);
    ds.getPointData().addArray(vtkDataArray.newInstance({ name: 'scale', values }));
    return ds;
  }
}

export default State;
