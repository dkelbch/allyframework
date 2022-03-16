/*
    \brief class implementation for a microservice
*/
import express from "express";
import cors from "cors";

import bodyParser from "body-parser";

import cl_account_connector from "./dbConnector.mjs";

import cl_auth_connector from "./authConnector.mjs";

const   errorCodes = {
  ERR_GEN       : {status:500, info:{text:"Server issue", detail:"none"}},
  ERR_CREDITIAL : {status:401, info:{text:"User or Password wrong", detail:"none"} },
  ERR_AUTH_TOKEN: {status:401, info:{text:"Authorization failed", detail:"none"} },
  ERR_AUTH_ROLE : {status:403, info:{text:"Access rights failed", detail:"none"} },

};

class   clwebservice{
    constructor(_name, _db, _authSecret, _sessionTimeout, _rootPort){
        this.name       = _name;
        this.rootApp    = express(); 
        this.rootPort   = _rootPort;

        this.debug      = true;

        this.hDB        = new cl_account_connector.cl_account_connector(_db);
        this.hAuth      = new cl_auth_connector.cl_auth_connector(this.hDB, _authSecret, _sessionTimeout);
        this.authDef    = {
            rootUri:"/auth/v1",
            restTable:[
              {uri:"/login", method:"post", auth:false, role:"none", fct:this.authLogin.bind(this)},
              {uri:"/logout", method:"post", auth:true, role:"none", fct:this.authLogout.bind(this)},
              {uri:"/refresh", method:"get", auth:true, role:"none", fct:this.authRefresh.bind(this)},
              {uri:"/signin", method:"post", auth:false, role:"none", fct:this.authSignin.bind(this)},
              {uri:"/verify", method:"get", auth:true, role:"none", fct:this.authVerify.bind(this)}

            ]
        };
    }

    userGet(_uid){
      return this.hDB.entryGet("uid", _uid);
    }

    userSet(_uid, _field, _value){
      this.hDB.entrySet(_uid, _field, _value);
    }

    serviceError(err,req,res,next){
      console.log("ERROR");
      console.log(err);
      let _err = this.errConverter("ERR_GEN", err.typeError);
      return res.status(_err.status).json(_err.info);
    }

    // web service error response
    errConverter( _errCode, _detail){
      let ret = errorCodes.ERR_GEN;
      if ( errorCodes.hasOwnProperty(_errCode)){
        ret = errorCodes[_errCode];
      }   
      if ( this.debug === true){
        ret.info.detail = _detail;
      }
      return ret;
    }
    // RESTAPI on authentication
    async authSignin(req,res){
      const {username, password, otp} = req.body;
      if ( otp==="Ich bin admin"){
        let _accObj = this.hDB.entryNew(username, {pwd:password});
        if ( _accObj !== undefined){
          // user created.
          res.status(200).json({text:"user successful signed in"});
        }
        else{
          let _err = this.errConverter("ERR_CREDITIAL", "user exists!");
          res.status(_err.status). json(_err.info);
        }
      }
      else{
        let _err = this.errConverter("ERR_AUTH_TOKEN", "token is still valid");
            res.status(_err.status). json(_err.info);
      }
    }

    async authLogin(req,res){
      const { username, password } = req.body;
      
      let _accObj = this.hDB.entryGet("user",username);
   
      if (_accObj !== undefined){
        let _ret = await this.hAuth.verifyPwd(username, password);

        if ( _ret === true ){
          // account is OK, let's generate JWT.
          if ( _accObj.lastToken === "invalid"){
            // generate only token if last token has expired.
            const authToken = this.hAuth.generateToken(_accObj.uid); 
            const role = _accObj.role ;       
            this.hDB.entrySet(_accObj.uid, "loginTrial", 0 );
            res.json({authToken, role});   
          }
          else{
            let _err = this.errConverter("ERR_AUTH_TOKEN", "token is still valid");
            _accObj.loginTrial++;
            this.hDB.entrySet(_accObj.uid, "loginTrial", _accObj.loginTrial );

            if (_accObj.loginTrial > 2 ){
              this.hDB.entrySet(_accObj.uid, "lastToken", "invalid");
            }

            res.status(_err.status). json(_err.info);

          }
        }
        else{
          let _err = this.errConverter("ERR_CREDITIAL", "password mismatch");
          res.status(_err.status). json(_err.info);
        }
      }
      else{
        let _err = this.errConverter("ERR_CREDITIAL", "user not found");
        res.status(_err.status). json(_err.info);
      }
    }

    authLogout(req,res){
      this.hDB.entrySet(req.user.uid, "lastToken", "invalid");
      //res.status(200);
      res.json({text:"logout successful", detail:"none"});
    }

    authRefresh(req,res){
      let _accObj = this.hDB.entryGet("uid", req.user.uid);

      if (_accObj !== undefined){
        const authToken = this.hAuth.generateToken(_accObj.uid); 
    
        res.json({authToken});         }
      else{
        let _err = this.errConverter("ERR_CREDITIAL", "user failed");
        res.status(_err.status). json(_err.info);
      }    
    }

    authVerify(req,res){
      res.status(200);
    }

    _authVerify(_authValid){
        return async (req,res,next) =>{
          if ( _authValid === true){
            // get token from header and validate and check content
            const authHeader = req.headers.authorization;
            if (authHeader) {
              const _token = authHeader.split(' ')[1];
              
              let ret = await this.hAuth.verifyToken(_token);
              if ( typeof(ret) === "object"){
                req.user = ret;
                next();
              }
              else{
                // token is invalid, expired, ....., error message is returned
                let _err = {};
      
                console.warn("[authVerify] : token failed on " + ret);
                switch(ret){
                  case "Expired":
                    _err = this.errConverter("ERR_AUTH_TOKEN", "Token has expired");
                    break;
                  case "WrongToken":
                    _err = this.errConverter("ERR_AUTH_TOKEN", "Received token is invalid");
                     break;
                  default:
                    _err = this.errConverter("ERR_GEN", "Token mgnt failed");
                    break;
                }
                return res.status(_err.status).json(_err.info);
              }
            }
            else{
              // token is not available
              let _err = this.errConverter("ERR_AUTH_TOKEN", "authorization header missing");
              return res.status(_err.status).json(_err.info);
            }
          }
          else{
            // authorization is not needed
            next();
          }
      } 
    }

    roleAccess(_accessRole){
        return async (req, res, next) => {
          if(_accessRole != "none"){
            if ( req.user !== undefined){
              let _entry = this.hDB.entryGet("uid",req.user.uid);
              if ( _entry !== undefined){
                if( _entry.role.indexOf(_accessRole) !== -1){
                  next();
                }
                else{
                  let _err = this.errConverter("ERR_AUTH_ROLE", "wrong role");
                  return res.status(_err.status). json(_err.info);
                }
              }
              else{
                let _err = this.errConverter("ERR_CREDITIAL", "user not found");
                return res.status(_err.status). json(_err.info);
              }
            }
            else{
              let _err = this.errConverter("ERR_GEN", "role analysis not possible");
              return res.status(_err.status). json(_err.info);
            }
          }
          else{
            next();
          }
      }
    }

    registerRESTController(_restObj){
        var  _router = express.Router();

        _router.use(bodyParser.json());

        Object.values(_restObj.restTable).forEach( _obj =>{
            const supportedMethod = ['post','put','get','delete'];
            if ( supportedMethod.includes(_obj.method) === true){
                _router[_obj.method]( _obj.uri, this._authVerify(_obj.auth), this.roleAccess(_obj.role), _obj.fct );
            }
        });
        // may we need to decide to have for each 
        // entity an own error handler
        this.rootApp.use(_router, this.serviceError);
        this.rootApp.use(_restObj.rootUri, _router);
    }

    logging(req,res,next){
        console.log("["+ this.name +"] " + req.method + " - " + req.originalUrl);
        next();
    }

    commonMiddleware(){
        this.rootApp.use(cors());
        this.rootApp.use(this.logging.bind(this));
        this.registerRESTController(this.authDef);
        // page not found error module....
        this.rootApp.use(this.serviceError);
    }

    startSrv(){
        //this.rootApp._router.stack.forEach(print.bind(null, []))

        this.rootApp.listen(this.rootPort, () => {
            console.log("["+ this.name +"] root server running on port: ", this.rootPort);
          });
    }
}
export default clwebservice;

function print (path, layer) {
    if (layer.route) {
      layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
    } else if (layer.method) {
      console.log('%s /%s',
        layer.method.toUpperCase(),
        path.concat(split(layer.regexp)).filter(Boolean).join('/'))
    }
  }
  
  function split (thing) {
    if (typeof thing === 'string') {
      return thing.split('/')
    } else if (thing.fast_slash) {
      return ''
    } else {
      var match = thing.toString()
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '$')
        .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
      return match
        ? match[1].replace(/\\(.)/g, '$1').split('/')
        : '<complex:' + thing.toString() + '>'
    }
  }
