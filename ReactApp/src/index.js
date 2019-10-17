import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import {unregister} from './registerServiceWorker';
import {store, persistor, history} from './store';

//let Module = require('./SharpnessGlare.js');
//let pingIt = Module().cwrap('pingIt'); // Call Module as a function

ReactDOM.render(<App routerHistory={history} store={store} persistor={persistor}/>, document.getElementById('root'));
unregister();


//module.exports = pingIt;