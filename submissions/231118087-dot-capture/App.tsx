
import { AppRegistry } from 'react-native';
import DotCapture from './DotCapture/App'; // <- DotCapture klasörünü ekledik
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => DotCapture);