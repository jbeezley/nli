import http from '@/http';
import State from '@/data/state';

class Simulation {
  constructor(id) {
    this.id = id;
    this.timeSteps = [];
    this.totalTimeSteps = 0;
  }

  async update() {
    const folders = (await http.get('folder', {
      params: {
        parentType: 'folder',
        parentId: this.id,
        limit: 0,
      },
    })).data.filter((f) => /\d/.test(f.name));

    this.totalTimeSteps = folders.length;
    const timeStepIds = [];
    for (let i = 0; i < Object.keys(folders).length; i += 1) {
      const folder = folders[i];
      timeStepIds[parseInt(folder.name, 10)] = folder._id;
    }

    for (let i = this.timeSteps.length; i < timeStepIds.length; i += 1) {
      const folderId = timeStepIds[i];
      // We actually want to load these serially to support progressive loading.
      // eslint-disable-next-line no-await-in-loop
      this.timeSteps.push(await State.load(folderId));
    }
  }

  static async load(id) {
    if (!id) {
      return null;
    }
    const simulation = new Simulation(id);
    await simulation.update();
    return simulation;
  }
}

export default Simulation;
