import {configReducer} from "./screens/reducers/configReducer";
import {processedDataReducer} from "./screens/reducers/processedDataReducer";
import {idPropertiesReducer} from "./screens/reducers/idPropertiesReducer";

export default {
    config: configReducer,
    processedData: processedDataReducer,
    idProperties: idPropertiesReducer
}