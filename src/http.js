import { RestClient } from '@girder/components/src';

const girderApi = 'https://data.kitware.com/api/v1';
const http = new RestClient({ apiRoot: girderApi });

export default http;
export { girderApi };
