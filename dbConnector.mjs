/*!
    \brief implementation of simple database interface

    dbStaticAccountData
    /accounts/uid {user:$USER, pwd:$PWD, role:$[parent,child,friend,admin], avatar:$AVATAR_ID}
    /lookup/user $UID
    
    dbDynamicAccountData
    /state/uid {present:[home,away,offline], lastLocation:$LOCATION}
*/

import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig.js';

import {v4} from 'uuid';


const       DBG_HEAD = "[dbConnector] ";

class           cl_account_connector{
    constructor(_db){
        console.log(DBG_HEAD + "Initialize with " + _db + " database");
        // filename, save after every push, human readable, separator
        // start-up phase lets keep every push and human readable
        this.db         = new JsonDB( new Config(_db,true, true,"/" )); 
    }

    entryNew(_user, _properties){
        let _obj = {
            uid         : v4(),
            user        : _user,
            pwd         : _properties.pwd  || "invalid",
            role        : _properties.role || "friend",
            avatar      : _properties.avatar || "unknown",
            lastToken   : 'invalid',
            loginTrial  : 0
        };

        // check first if user exist or not
        if (this.entryGet("user", _user) === undefined ){
            this.db.push("/accounts/"+_obj.uid, _obj);
            this.db.push("/lookup/" + _user, _obj.uid);
            return _obj.uid;
        }
    }

    entryGet(_key, _value){
        let _accPath = "/accounts/";

        if ( _key === "user"){
            try{
                _accPath += this.db.getData("/lookup/"+_value);    
            }catch(e){
                console.warn(DBG_HEAD + "user " + _value + " does not exist!");
                return;
            }
        }
        else{
            _accPath += _value;
        }
        try{
            return this.db.getData(_accPath);
        }catch(e){
            console.warn(DBG_HEAD + "uid " + _accPath + " does not exist!");
            return ;
        }
    }

    entrySet(_uid, _field, _value){
        if ( _field != 'uid'){
            let _entry = this.entryGet("uid", _uid);

            if ( _entry !== undefined ){
                // delete user from lookup 
                if (_field === "user"){
                    this.db.delete("/lookup/" + _entry.user);
                    this.db.push("/lookup/" + _value, _uid);
                }
                this.db.push("/accounts/"+_uid+"/"+_field, _value);
            }
        }
    }
    entryDel(_uid){
        let _obj = this.entryGet("uid", _uid);
        if ( _obj !== undefined){
            this.db.delete("/accounts/"+_uid);
            this.db.delete("/lockup/"+_obj.user);
        }
    }
}

export default { cl_account_connector };


if (process.env.TEST === 'on'){
    console.log("Jest test inteface should be used for test purpose!")
    var _testDB = new cl_account_connector("testacc.json");
    _testDB.entryNew("dirk", {pwd:"dirk123", role:"parent"});
    /*
    let _entry = _testDB.entryGet("user", "dirk");
    if ( _entry !== undefined)
        _testDB.entrySet(_entry.uid, "user", "pamela");
    else
        console.log("testcase failed!");*/
}

