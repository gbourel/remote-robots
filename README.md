# Remote-robots

Application de pilotage à distance pour robots : Sphero et Dobot magician.

[https://robots.nsix.fr](https://robots.nsix.fr)

## Description

Un élève connecté à l'ENT peut envoyer son programme vers le robot. Il est alors placé dans une file d'attente et peut être lancé dès que le robot est disponible.

### Commandes pour Sphero

 * **connect** : connection bluetooth au robot et renvoi un objet robot Sphero
 *  **Sphero.set_rgb_led(int: r, int: g, int: b)** : allume les LEDs principales avec la couleur choisie. Chaque composante est codée sur un octet \[0-255\] ;
 * **Sphero.move(int: direction)** : déplacement à vitesse constante (50) dans la direction donnée \[0-359\] ;
 * **Sphero.roll(int: direction, int: speed)** : déplacement à vitesse choisie \[0-255\] dans la direction donnée \[0-359\] ;
 * **Sphero.wait(int: duree)** : attente en secondes.

### Commandes pour Dobot

Le module python pour le robot Dobot s'appelle `pydobot`

 * **Dobot** : connection USB au robot et renvoi un objet robot Dobot ;
 * **Dobot.move_to(int: x, int: y, int: z, int: r)** : déplace le robot à la position (x, y, z, r) ;
 * **Dobot.suck(bool: active)** : permet d'activer ou d'éteindre la pompe à vide

Exemple de progamme :

```python
import pydobot

robot = pydobot.Dobot()

x, y, z, r = (120, 0, 50, 0)
robot.moveTo(x, y, z, r)
```

## Développement

Pour tester localement l'application web : `npm start`

Pour le lancement des serveurs de communication avec les robots voir les répertoires `spheroCmd` et `dobotCmd`

## TODO

 * add vite build
 * static check python program on send (client side)
 * feedback for python running error
 * sensors values as CSV
 * sensors values as graph
 * handle bluetooth connection error in bluetooth server

