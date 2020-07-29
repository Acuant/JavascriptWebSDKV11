import {configReducer} from "./screens/reducers/configReducer";
import {processedDataReducer} from "./screens/reducers/processedDataReducer";
import {idPropertiesReducer} from "./screens/reducers/idPropertiesReducer";
import {capturedReducer} from "./screens/reducers/capturedReducer";

export default {
    config: configReducer,
    processedData: processedDataReducer,
    idProperties: idPropertiesReducer,
    captureProperties: capturedReducer
}