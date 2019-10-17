const fs = require('fs');
const envfile = require('envfile');

const buildAPIToken = () => {
    envfile.parseFile('.env', function (parseError, obj) {
        if (!parseError) {
            let userName = obj['REACT_APP_USER_NAME'],
                password = obj['REACT_APP_PASSWORD'];

            let authToken = new Buffer(`${userName}:${password}`).toString('base64');
            obj['REACT_APP_AUTH_TOKEN'] = authToken;
            envfile.stringify(obj, function (err, str) {
                if (err) {
                    throw new Error(err);
                }
                fs.writeFile('.env', str, function(error) {
                    if(error) {
                        throw new Error(error);
                    }
                })
            })
        } else {
            throw new Error(parseError);
        }
    });
};

if (require.main === module) {
    buildAPIToken()
} else {
    module.exports = buildAPIToken
}