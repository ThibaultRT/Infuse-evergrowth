import './style.css';
import { Game } from './game/Game';
import { applyVersionTag } from './version';

applyVersionTag();
new Game().start();
