import hWebSrv from "./clwebservice.mjs";

let apiDef = {
  rootUri:"/api/v1",
  restTable:[
    {uri:"/infos", method:"get", auth:false, role:"none", fct:infoGet},
    {uri:"/protected", method:"get", auth:true, role:"none", fct:infoGet},
    {uri:"/admin", method:"get", auth:true, role:"admin", fct:infoGet},
    {uri:"/parents", method:"get", auth:true, role:"parents", fct:infoGet}
  ]
}

function  infoGet(req,res){
  console.log("infoGet: " + req.url );
  res.status(200).json({info:req.url});
}

let _test = new hWebSrv("TestSrv","famDB.json","qwertasdfv1230987!", "60m", 3002);
_test.commonMiddleware();

_test.registerRESTController(apiDef);
_test.startSrv();