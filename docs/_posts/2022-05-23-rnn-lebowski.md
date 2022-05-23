---
layout: post
title: More fun with Recurrent Neural Networks - The Big Lebowski 
---

My view of machine learning (from a software development perspective) is: letting software create other software by providing training material, as opposed to letting humans create software. 

Within machine learning (ML), I understand Convolutional Neural Networks (CNNs), but have been struggling a bit with Recurrent Neural Networks (RNNs). So I set out to explore and learn!

## Background

The following description by [Andrej Karpathy](https://twitter.com/karpathy) in his [seminal blog post](http://karpathy.github.io/2015/05/21/rnn-effectiveness/) stuck with me:

> If training vanilla neural nets is optimization over functions, training recurrent nets is optimization over programs.

Combining this statement with my view on ML above, you can say the following: 

* with CNNs, the created software is a "stateless" function, where you feed it a single input of fixed size;

* With RNNs you actually create a program with variables that depend on an initial state; that state changes over time by continuously feeding the RNN new inputs.

Karpathy gives an example how to train an RNN on the entirety of Shakespeare's works - with the goal of generating "new" Shakespeare material. From that blog post, here's an example of freshly generated "AI Shakespeare":

    PANDARUS:
    Alas, I think he shall be come approached and the day
    When little srain would be attain'd into being never fed,
    And who is but a chain and subjects of his death,
    I should not sleep.

Amazing, right? It's gibberish, but it sure sounds like Shakespeare! I wanted to do the same.

## Make your own RNN
Tensorflow has a [tutorial](https://www.tensorflow.org/text/tutorials/text_generation) that lets you reproduce Karpathy's work. The good boyscout in me faithfully copied and pasted the provided code into a Jupyter Notebook and let it run. Using the same Shakespeare training set, I generated the following wonderful prose:

    ROMEO:
    I do pretent to Rome, come; Momed that,
    For mirroant-tongued together, to thy lord,
    Upon so orperalling me speak to him:
    Some hath mother, throw up ta live, that thousand faithant
    Well-counio so, without decay: descend at dayman
    Citizens doth cry it so well;
    No man belseit in fore and Die Richmond!

## Enter The Dude

(Side note: if you haven't read [Two Gentlemen of Lebowski](https://www.amazon.com/Two-Gentlemen-Lebowski-Excellent-Tragical/dp/1451605811), you should. It's The Big Lebowski written as a Shakespeare play.)

I love The Big Lebowski, the Coen brothers' 1998 cult film, so what could be better than generating more Lebowski using RNNs?

I took the exact same notebook as above and replaced the source text with the Big Lebowski screenplay. Here's a few lines from the input:

    The Dude, also holding a large plastic cup of Bud, wears
    some of its foam on his mustache.

                    WALTER
            This was a valued rug.

    He elaborately clears his throat.

                    WALTER
            This was, uh--

                    DUDE
            Yeah man, it really tied the room
            together--

                    WALTER
            This was a valued, uh.

## Training the RNN

(I will not go into detail on how the training process works or how to generate output - you should really check out the tutorial!)

By training, we teach the RNN to correctly "predict" characters given a set of preceding input text of fixed length. So if the input text is `The Dude, also holding a large plastic cup of Bu` then the correct prediction would be the character `d`. If we do this with a large enough set of samples, and train often enough, the RNN should become accurate enough to predict meaningful texts.

Generating new text is really simple: 

* you provide the RNN with a prompt - for example, `JACKIE TREEHORN`; 

* it will predict the next character; 

* you append that character to the prompt;

* repeat.

### After 10 training rounds

Here's what the RNN comes up with after 10 rounds ("epochs") of training:

                    MABWYOR

    Thy in's bonel
            decoutery gam.

                    AADTER
            HER LEIBMALSSY?
            Fucke.  Wantee hishe gowt on Beyo
            ar on the I'
            youre, ma.  I dowallyote, Luy full, wo siatlo, Wat mar, uhingeyes.

First off - the model doesn't fully understand the standard screenplay formatting rules. (Or as Walter would say: This isn't 'Nam.) 

Secondly - the characters sound like they either had their tongue paralyzed or are regulars in a Scottish pub - or both. 

Clearly, the RNN doesn't "know" the source text well enough to make intelligible predictions.

Here's some more:

                    DUDE
            I told money you one moneys to
    everything.  On a fucting exering them's the emblams.  He is the Wobar.  All fitter, and
            they poinet of as he spiph you un, Dude.

                    DUDE
            I'm gettink on the rail, rest you're-

                    DUDE
            .... uh, but--

                    MAUDE
            --word it for you.  That's your vairbox?

### After 20 more rounds

It's getting a bit more readable now - although it all still sounds very "drunk":

    Walter blung some zarmout and will.

                    DUDE
            You're gain got about the fucking
            occusior luce?

    Walter prudes in to plase, he wnops with flishor is taked open the Dude's car.,
    Dieter, it the phone him of geeting in slow motion.  Me and headle askig the Dude turns thrown
    outing from the satchel put of his head.
    out for it, his irmothing into the three men turn to loen.

                    DUDE
            This fucking eaty mininess.

I'm snorting milk out of my nose right now:

    DUDE
            What the fuck are you talking about?

                    LEBOWSKI
            Well, All you something, is suckeds, I dan from
            which leng git home of Lebowski?

                    WALTER
            Huh?  Oh, this fuck is the busi?

            Soothim. I'm not if--

                    LEBOWSKI
            You got a whole cates--

                    DUDE
            Who the fuck're you talking about?

                    DUDE
            Now that fom he mistly handle
            ago?  Dude is Walter Solfbacks!  AM
            SCOKHY BOWLING IS IN WAL, Ar A lar, Alleady!

### 20 more rounds

    Walter bashes him a few more time on ole almonatapal, then quiet.  Laid out now, Franz too is
    Bunny Lebowski, falfing at etwing.

                    DUDE
            What's your point, Walter?

                    WALTER
            You're just looking for a handout
            look, a dos in one hands in take
            forlet my dight.

                    DUDE
            No.  Here.

                    YOUNGER COP
            Separate incidents?

    The Dude steps out to meet Walter's car as it ruds blowing ball.

By this point, I think it shows that the Big Lebowski script is a mere 131 thousand characters long. There's only so much you can train your RNN on before you start recreating it line by line. 

## What's next

To overcome the limited input, I've been thinking about combining many different movie scripts set in Los Angeles - Chinatown, The Big Lebowski, Blade Runner, To Live and Die in L.A., Point Break, Falling Down, Die Hard, L.A. Confidential (to name a few) and do the same thing. I predict lots of ins, outs, what-have-yous all set in a dreamscape meta retro-futuristic Los Angeles...

Also, to make the text more meaningful, the RNN should have some notion of "attention" - there needs to be some kind of character and environment persistence. 

On that note:

                    VOICE-OVER
            sometimes there's a man. . . sometimes
            there's a man.
            
            Wal, I lost m'train of thought here.
            But--aw hell, I done innerduced him
            enough.