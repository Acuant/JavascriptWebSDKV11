import storage from "redux-persist/es/storage";
import thunk from 'redux-thunk';
import createHistory from 'history/createBrowserHistory';
import {persistCombineReducers, persistStore} from "redux-persist";
import { connectRouter, routerMiddleware } from 'connected-react-router'
import {createStore, applyMiddleware} from 'redux';
import rootReducer from './rootReducer'

const loggerMiddleWare = store => next => action => {
    console.log("[LOG] Action triggered", action);
    next(action);
};

/**
 * cardType: 1 for ID/Passport, 2 for Medicard
 */
const initialState = {
    config: {
        instanceID: null,
        frontSubmitted: false,
        backSubmitted: false
    },
    processedData: {
        faceMatch: null,
        result: null
    },
    idProperties: {
        cardType: 0,
        orientation: 0,
        sidesLeft: 2
    },
    captureProperties:{
        image:{
            data:"",
            width: 0,
            height: 0
        },
        glare: -1,
        sharpness: -1
    }
};

export const history = createHistory({basename: process.env.REACT_APP_BASENAME});

const config = {
    key: 'idscango',
    storage,
    blacklist: ['config', 'processedData', 'idProperties', 'captureProperties'] 
};

const reducer = persistCombineReducers(config, rootReducer);

function configureStore() {
    let store = createStore(
        connectRouter(history)(reducer),
        initialState,
        applyMiddleware(thunk, loggerMiddleWare, routerMiddleware(history))
    );
    let persistor = persistStore(store);
    return {persistor, store};
}

export const {persistor, store} = configureStore();