/*!
    function to run authorization and authentication
*/
const   DBG_HEAD="[authConnector] ";
//const   {sign, verify} from 'jsonwebtoken';

//const   jwt = require('jsonwebtoken');
import   jwt from 'jsonwebtoken';

class   cl_auth_connector{
    constructor(_objDB, _authSecret, _sessionTimeout){
        this.hDB            = _objDB;
        this.authSecret     = _authSecret || "testSecrect241200";
        this.sesionTimeout  = _sessionTimeout || "2m";
    }

    verifyPwd(_user, _pwd){
        return new Promise( resolve =>{
            let _entry = this.hDB.entryGet("user", _user);
            if ( _entry !== undefined){
                if ( _entry.pwd === _pwd){
                    resolve(true);
                }
                else{
                    console.warn(DBG_HEAD + _user +" used wrong password!")
                }
            }
            else{
                console.warn(DBG_HEAD + "user does not exist!");
            }

            resolve(false);
        });
    }

    verifyRole(_uid, _role){
        let _entry = this.hDB.entryGet("uid", _uid);
        if ( _entry !== undefined){
            if ( _entry.role === _role){
                return true;
            }
            else{
                console.warn(DBG_HEAD + _user +" does not own the role!")
            }
        }
        else{
            console.warn(DBG_HEAD + "user does not exist!");
        }

        return false;
    }

    generateToken(_uid){
        let _entry = this.hDB.entryGet("uid", _uid);
        if ( _entry !== undefined){
            const _token = jwt.sign({ uid: _entry.uid,  role: _entry.role }, this.authSecret, { expiresIn: this.sesionTimeout });
            this.hDB.entrySet(_entry.uid, "lastToken", _token);
            return _token;
        }
        else{
            console.warn(DBG_HEAD + "user does not exist!");
        }
    }

    verifyToken(_token){
        return new Promise( resolve =>{
            jwt.verify(_token, this.authSecret, (err, user) => {
                if (err) {
                    if ( err.name === 'TokenExpiredError'){
                        console.log("userTokenExpired");
                        resolve("Expired");
                    }
                    else{
                        resolve(err.name);
                    }
                }
                else{
                    let _entry = this.hDB.entryGet("uid",user.uid);
                    if ( _entry !== undefined){
                        if (_entry.lastToken === _token){
                            console.log(user);
                            resolve(user);
                        }
                        else{
                            console.warn("wrong token!");
                            resolve("WrongToken");
                        }
                    }
                    else{
                        resolve("UserMissing");
                    }
                }
            });     
        })
    }
}

export default {cl_auth_connector};