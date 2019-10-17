import axios from 'axios'
import axiosRetry from 'axios-retry';
/*
 global window
 */

const client = (() => {
    return axios.create({
        baseURL: process.env.REACT_APP_ID_ENDPOINT
    });
})();

axiosRetry(client, { retries: 3 });

const request = function(options, store) {
    const onSuccess = function(response) {
        console.debug('Request Successful!', response);
        return response.data;
    };

    const onError = function(error) {
        return Promise.reject(error.response || error.message);
    };

    if (process.env.NODE_ENV === 'development') {
        let AUTH_TOKEN = btoa(`${process.env.REACT_APP_USER_NAME}:${process.env.REACT_APP_PASSWORD}`);
        options.headers = {
            "Authorization": `Basic ${AUTH_TOKEN}`,
        };
    } else {
        options.headers = {
            "Authorization": `Basic ${process.env.REACT_APP_AUTH_TOKEN}`,
        };
    }

    return client(options)
        .then(onSuccess)
        .catch(onError);
};


export default request;
