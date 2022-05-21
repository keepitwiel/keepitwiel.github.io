---
layout: post
title: Quick recap
---

![The player map with stats on the side.](/images/2014-12-25_romvlvs_development_screenshot_0.png)

(Quick recap: I’m trying to build a Civilization/SimCity crossover, 
combining the bottom-up fun of SimCity with Civ’s top-down joy of 
conquering the world.)

A long overdue update. I renamed the game from Civpy, which was 
really just a working title, to ROMVLVS (notice the ancient Latin 
spelling of the letter ‘U’).

I also gave up on pixel art (Python/Pyglet) and rebuilt the game 
around a cool true-color ASCII based engine called libtcod. 
Fortunately, it’s available for Python so I could sorta easily weasel 
the library into the existing code.

The main reason for this is speed, both in true game speed as well as 
development speed. I just couldn’t get Pyglet to operate fast enough 
with my limited knowledge of programming, and libtcod gets around 
that by being precompiled. Also putting pixels in PNGs is very 
laborous and tiring.

Enter ASCII. For some reason being limited to 256 characters is very 
liberating. Two games currently are major sources of inspiration: 
[Ultima Ratio Regum](https://ultimaratioregum.co.uk) 
and Cogmind (see [this excellent post](https://www.gridsagegames.com/blog/2014/03/ascii-art/) 
on ASCII-based games by Cogmind’s developer).

Both games are roguelikes. I don’t like roguelikes that much, 
especially if they involve fantasy creatures like orcs, dwarves, 
goblins etcetera. What I like about roguelikes though is that they 
have a very clear focus on graphical aesthetics. 

What you see in this photo is the player map with some tile stats on 
the side, such as altitude and temperature. These stats are important 
as they will give you a clue how suitable the tile is for different 
types of buildings.

In this game there are 5 people living under the ’@’ character. I 
haven’t built anything yet but at this point there are 2 options: a 
settlement or a farm.

A settlement provides shelter which helps with population growth in the 
area. A farm just increases population growth on its own tile.

Both cost wood to build, and the caveat is that you can only use wood 
from your direct surroundings. So naturally I would need a logging 
station nearby as an additional building. That one sorta works (I 
already tried it), but I’m not satisfied with its dynamics. Basically 
you would need to build swathes of loggers in concentric circles around 
wherever your city center is, which is not very fun.

I’m working on a Mac, and the problem is that libtcod is only available 
for Windows and Linux. So for now I’m developing/running this game on a 
VM Lubuntu instance. I’ll try to make the game available for download 
as soon as I figure out how to bundle it :)

Next I probably need to overhaul the GUI because it’s very hard to know 
what’s going on.

Thanks for reading and stay tuned!
