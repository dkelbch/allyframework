/*!
    API to provide subjects

*/
import cl_account_connector from "./dbConnector.mjs";

class   cl_subjectplan {
    constructor(_hDB){
        this.hDB = _hDB;
        this.apiDef ={
            rootUri:"api/v1/subjectplan",
            restTable:[
                {uri:"/weekplan", method:"get", auth:true, role:"family", fct:this.weekplanGet.bind(this)},
                {uri:"/dayplan", method:"get", auth:true, role:"family", fct:this.dayplanGet.bind(this)}
            ]
        }

    }

    weekplanGet(req,res){
        const {weekNo} = req.body;
    }

    dayplanGet(req,res){
        const {weekNo,dayNo} = req.body;
    }
};

let apiDef = {
    rootUri:"/api/v1",
    restTable:[
      {uri:"/infos", method:"get", auth:false, role:"none", fct:infoGet},
      {uri:"/protected", method:"get", auth:true, role:"none", fct:infoGet},
      {uri:"/admin", method:"get", auth:true, role:"admin", fct:infoGet},
      {uri:"/parents", method:"get", auth:true, role:"parents", fct:infoGet}
    ]
  }