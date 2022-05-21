---
layout: post
title: ROMVLVS engine philosophy
---

In short, I aim for ROMVLVS to be some sort of SimCity++, taking you from 
prehistoric to modern times while also invoking some Civ-like concepts 
such as research and warfare.

ROMVLVS, like the original SimCity, leans heavily on the idea of cellular 
automata. Basically, simple rules governing the contents of tiles lead to 
very complex behaviour. 

The original concept popularized by Conway is very binary (either life 
exists on a tile or not); SimCity made use of difference equations in 
order to increase or decrease the quantity of e.g. population on a tile. 
This is the same in ROMVLVS. A simplified set of equations might look like 
this (`x` and `y` are quantities to be increased/decreased, `t` is time, `t+1`
 is the time at the next turn):

```
x(t+1) = x(t) + C1 * x(t) + C2 * y(t)
y(t+1) = y(t) + C3 * x(t) + C4 * y(t)
```

In SimCity you were free to build wherever you wanted, as long as you had 
enough money to do so. The existing infrastructure generates taxes, which 
fills the city coffers.

In ROMVLVS, there is no money. Or, at least, not centralized. If you don’t 
have resources available in a specific tile to build something, you can’t 
build it, even though it’s available on other tiles.

So how do resources spread around? This is where dispersion comes in place. 
Think of an inflatable pool in your back yard. When you pierce it, it will 
empty out in rapid pace, flooding its surroundings. The more time goes by, 
the more dispersed the water is, eventually flooding your entire garden 
with a thin layer of water.

In ROMVLVS, dispersion works as follows: if you have a farm producing 1 
unit of food per turn, a small percentage of that (say 10%) gets dispersed 
to the four surrounding tiles. Your farm will be left with 0.9 units while 
its neighbors get 0.025 units each. Those neighboring tiles will disperse 
10% of 0.025 to their neighbors in the next turn.

In order to keep infinitisemally small amounts of resources spreading 
around the map, there’s a dispersion threshold.

At the beginning of a game, you start with a Settlement and 5 people (all 
living in the Settlement). The Settlement produces Culture (quite an 
abstract resource) which starts spreading outward over time. The difference 
equation governing the growth of people is such that Culture is a positive 
factor - i.e.:

`Humans = Humans + CULTURE_FACTOR * Culture`

Now, resources like Food have also a similar positive influence whereas 
proximity to enemies, extreme temperatures etc. will negatively impact 
human growth.

This basically describes the ROMVLVS engine. The trick is to balance out 
all the different resources: adjusting growth and dispersement parameters, 
adding buildings that modify growth even further, and adding resources that 
counterbalance other resources. So far, only Culture, Humans, Food and Wood 
are “active” resources that can be altered; I’ve thought about adding things 
like Disease, Fear, Stone, Bronze, Meat, Fruit, etc. etc.

Hope you enjoyed this behind-the-scenes look!

