const path=require("node:path");
const root=path.resolve(__dirname,"../../../../../web");
module.exports={root,resolve:{alias:{lib:path.join(root,"lib")}},test:{environment:"node",include:[path.join(__dirname,"w3-forge-projections-part3-4-crosscheck-fixtures.test.ts")],setupFiles:[]}};
