import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export default {root,envDir:false,resolve:{alias:{lib:`${root}/web/lib`}},server:{fs:{allow:[root]}}};
