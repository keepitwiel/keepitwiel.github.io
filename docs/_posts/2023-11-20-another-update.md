---
layout: post
title: ROMVLVS - What's new in 2023
---

Since the last update 8 months ago I've restarted the project from scratch. 

![Screenshot of a city](/romvlvs/images/2023-11-10-map.png)

To give you a short recap, the idea behind ROMVLVS is bridge the gap between
SimCity and Civilization - build massive, detailed civilizations on huge
maps without having to micromanage (at least not too much).

How does it work? You simply click on the map where you want to build a city,
and buildings and roads start to appear. There is a budget, so you have to
be smart about where to build.

Currently at version 0.15.4, the main improvements over the last version are:
- massive maps: the default is now 2000x2000 tiles
- user interface: I've finally bothered to implement an actual GUI
- responsiveness (60FPS at all times)
- hybrid grid/vector based hydrodynamics
- automatic road building (when adding population to map)

Improvements I want to make down the line:
- make rendering as realistic as possible without resorting to
a full blown 3D engine
- have the ability to zoom in and admire cities in detail
- improve the gameplay: the budget should increase based on how prosperous
the existing population is
- provide a macOS download

Last but not least: my thanks go out to [Sebastian David Lees](https://twitter.com/sebs_tweets) for some important alpha testing!