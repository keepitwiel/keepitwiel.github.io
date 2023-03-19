---
layout: post
title: ROMVLVS2020
---

It's been nearly 9 years since I started this blog, 
primarily about the SimCity/Civilization crossover game
I've been working on, and about 25 years since I first
thought about it. Time flies!

From [a post](https://keepitwiel.github.io/2017/07/30/ROMVLVS_engine_philosophy.html) I wrote in 2017:
> In short, I aim for ROMVLVS to be some sort of SimCity++, taking you from 
prehistoric to modern times while also invoking some Civ-like concepts 
such as research and warfare.
>
> ROMVLVS, like the original SimCity, leans heavily on the idea of cellular 
automata. Basically, simple rules governing the contents of tiles lead to 
very complex behaviour. 

Since the last official update in 2019, I've been hard
at work at reinventing the whole concept. The underlying 
philosophy is still based on cellular automata - or, more 
generally speaking, 2D differential equations - but I've simplified
the whole user experience. In 2020, I started with an entirely
new codebase - why not? - and renamed the project ROMVLVS2020.
(And here we are, in 2023!)

In the current version (v0.13.9.2), the building 
selection menu is gone. The reason: if you want to simulate a 
gigantic map where a single tile represents 10x10 meters, you're 
not going to enjoy micromanaging every addition to your city.

Instead, you dump a cloud of people on the map and let the engine
build the city. Here is a short video showing a city being built:

![Building a city](/romvlvs/images/2023-03-17-building-city.gif)

## A brief history of ROMVLVS2020

In the new codebase, I originally wanted to have city centers 
represented by distinct objects, so the engine could 
automatically create roads between cities. Also, it would 
help keeping track of city population and the likes. In turn,
city population would determine the city limits.

Here you can see the new concept in an early screenshot (version unknown):

![City centers, roads](/romvlvs/images/2023-03-17-city-centers.png)

Below is an iteration which includes forests and rivers.
The roads evolved over time: the closer two cities were
together, the bigger the roads were. As a bonus, 
it has a nice pixely feel to it (v0.7.7):

![City centers, roads, rivers](/romvlvs/images/2023-03-17-city-centers-2.png)

However, keeping city objects and the map grid as separate 
entities somehow didn't work great. For each city, a separate
map needed to be kept to indicate the city limits. And what
would happen where two cities meet - which city owns which tile?

On top if that, I started noticing performance issues. The more cities,
the more pathfinding you have to do to connect them by roads.

## No more city centers
Instead, I started to populate the map directly - in a later
stage I would have to add a postprocessing layer indicating
which blob of people would become a village, town or city.

Immediately you can see the benefit - a 1280x800 map operating at 60fps (v0.9.0):

![Direct population](/romvlvs/images/2023-03-17-direct-population.png)

Notice also the river network - this started to bother me, and needed to fix it.

## Rivers

The way I calculated rivers was as follows:
- I randomly selected a point on the map.
- I let a "raindrop" fall from that point to the 
coastline.
- The resulting path was the river.

This is a nice beginning, but there are some problems:
- Rivers sometimes stop inland and never create lakes; therefore
  there can never be "buffer lakes" that first fill up
  after which the river proceeds on its journey to the ocean.
- Rivers always are 1 tile wide.
- "compounding" rivers creates a nice tributary effect, where 
  streams from different origins converge to a big river, but
  they never grow wider or cause the river flow to behave
  differently (a small stream will flow through the land different
  from a big one).
- Rivers don't influence the global water level.
- Rivers are separate entities from the ocean, creating overhead.
- There is no erosion.

I needed to introduce some kind of hydrodynamical model to solve this.

## Hydrodynamics

Long story short, I adapted a freely available model that worked well
enough for my needs. You can find my version [here](https://github.com/keepitwiel/hydraulic-erosion-simulator).

The benefits of using this model are:

- It integrates very easily into the existing engine.
- It unifies the existing "ocean" and "river" layers into one "water" layer.
- I don't need to use pathfinding to determine river paths.
- It allows lakes with in- and outflow.
- Rivers can have varying depth and width.
- It allows water velocity, sediment and erosion.

Here you can see the result (v0.13.0) - looks pretty cool:

![Hydrodynamics](/romvlvs/images/2023-03-17-hydrodynamics.png)

Performance is an issue right now, but because the 
hydrodynamical model doesn't need to run in real time, 
we can dial down on the computations.

## Population, revisited

After implementing the hydrodynamics, I could get back to 
the actual city/civilization aspect, which had been relegated 
to the background a bit.

The eternal question is: where does the user input end,
and where does the engine take over? As I mentioned earlier,
micromanagement was out - building individual roads and
buildings seemed like too much of a chore. 

As a starting point, I settled on a pure simulation:
seeding the map with some initial population, and let the
engine figure out population growth, roads, second order
interactions and so on. I would figure out the user part
later.

Automatic road building is a relatively easy concept - 
find a start and end point, and let a pathfinding algorithm
determine where the road goes. Like with rivers, 
compounding roads creates a nice differentiating effect.
As you can imagine, if you let population density determine
start and end point, your big roads will end up going
between big cities, while the smaller ones are between towns,
etc.

To take this even further, you can use this approach to 
build a very realistic "medieval" city grid as shown here (v0.13.7.5):

![Medieval city grid](/romvlvs/images/2023-03-17-city-roads.png)

Brighter colors mean a more densely used road.

Again, there is a drawback: by this point I'd let 
population influence where roads were built, and in 
turn roads determined where population 
would go. This feedback loop meant that the highest
population density was on the roads themselves,
not in the areas between them!

Therefore, I'm leaving roads out at the moment. I
did briefly think of using the hydrodynamic model to
simulate roads, but that requires some brainpower
to figure out all the analogies. Here's a "city" as
it is right now, without roads:

![No more roads](/romvlvs/images/2023-03-17-no-roads.png)

As for population growth, there is currently none.
A user can now just add population by pointing and
clicking on the map, like a paintbrush.

## Lighting

As you can tell, over time I've changed the colors 
and lighting a lot. Right now, I'm using a very simplified
raytracing approach, where each tile (equivalent to 1 pixel)
shoots a ray to the sun. If it is blocked, only ambient
reflection is shown.

The problem (as you can imagine) comes when we want to determine
 lighting on a water tile. Again, this is something for later.

## Conclusion

I'm very proud of what I've achieved so far. But challenges 
remain.

First and foremost, the boundary between user input and game engine.
Am I going to make an entirely passive simulator, or should I
bring in some interaction? And where does that end?

Next, population growth - it's difficult to set parameters where
population grows steadily into a nice city, and then reaches some
kind of limit. From experience, either it shrinks to nothing or
grows out of control.

Also, what determines population growth - food? Where does it 
come from? And is it in turn influenced by population? I 
experimented with a concave food production "curve" that 
was highest at some population level, and then gradually sloped
down. As you can imagine, it's hard to grow food in a city
center, but easier on the outskirts.

So for now, I'm going to stick with the population 
"paintbrush" mode. I think for now the value is in reinventing
the road generation algorithm, increasing FPS and working out
the graphics layer - have some kind of simple rules that
generate a vibrant, complex looking city.

Thanks for reading and until the next post!