_TL;DR: not worth it, but fun!_

I had a couple of idle Rasberry Pi 3B+ lying around, so I decided to see if they could run a small "large" language model (LLM) and what the performance would be. Foolhardedly and against better judgment I thought could put them to work as clankers for my software development efforts. At the very least I would have learned something along the way.

I set out to benchmark a few models on the following criteria:
* RAM consumption
* Token generation speed
* Perplexity
* 40 multiple-choice questions
* Code review

These benchmarks were more of an off-the-cuff plan to get a feel for what's possible.

Honest gate (apologies to Claude 4.8) - I did learn something along the way, namely that a 3B+ is not very suitable for day-to-day intelligence. It won't get you a Skyrim clone in polynomial time. But it's fun to play around with.

Enough about the results - let's dig into the details!

## Raspberry Pi 3B+

The odds are stacked against this cigarette-box-sized computer - it might have packed a punch when it came out in 2017, but with just 4 Cortex-A53 cores and 1 GB of LPDDR2 RAM (which I assume is 800Mbps in the Pi) you're not going to run a big model these days - not fast at least.

The main bottleneck is memory speed: the cache needs to load model weights from RAM before any calculation can be done. This is governed by the memory transfer rate. In modern GPUs the transfer rate is three to four orders of magnitude higher than in our example.

The other is memory size: we're not going to get much intelligence out of 1 GB worth of floating points.

## Model choice & RAM benchmarks

Here are the models I chose for my benchmark, obviously capped by the memory available - with the chosen OS, I had at most 750MB RAM to play with:

| model | parameters | quantization | size (MB) [1] | peak RSS (MB) [2] |
| --- | --- | --- | --- | --- |
| smollm2-135m-instruct | 135M | Q4_K_M | 101 | 136 |
| gemma-3-270m-it | 270M | Q4_K_M | 241 | 303 |
| lfm2.5-350m | 350M | Q4_K_M | 219 | 256 |
| granite-4.0-h-350m | 350M | Q4_K_M | 212 | 280 |
| smollm2-360m-instruct | 360M | Q8_0 [3] | 369 | 409 |
| falcon-h1-0.5b | 500M | Q4_K_M | 300 | 363 |
| qwen3-0.6b | 600M | Q4_K_M | 378 | 462 |
| qwen2.5-0.5b-instruct | 500M | Q4_K_M | 469 | 532 |
| qwen3.5-0.8b | 800M | Q4_K_M | 508 | 549 |

<small>
[1]: size is the GGUF size of the model as stored on file.<br>
[2]: RSS = Resident Set Size: the physical RAM occupied while the model was loaded and running<br>
[3]: smolLM2 official repo only ships Q8_0
</small>

## Prompt Processing and Token Generation Speed
Prompt processing, or prefill, is the speed at which the model fills the context from the input prompt - this is usually compute-bound. Token generation is the speed at which tokens are generated after the input prompt and is memory-bound. I used 512 prefill tokens (pp512) and 128 for token generation (tg128).

As you can imagine, smaller models fill the context and generate tokens faster:

| model | pp512 t/s | tg128 t/s |
| --- | --- | --- |
| smollm2-135m-instruct | 17.75 | 12.14 |
| gemma-3-270m-it | 18.03 | 7.16 |
| lfm2.5-350m | 8.91 | 5.72 |
| granite-4.0-h-350m | 8.13 | 4.47 |
| smollm2-360m-instruct | 7.13 | 5.24 |
| falcon-h1-0.5b | 4.85 | 3.43 |
| qwen3-0.6b | 5.24 | 3.10 |
| qwen2.5-0.5b-instruct | 5.81 | 3.88 |
| qwen3.5-0.8b | 3.98 | 2.02 |

At first, I let the benchmark rip through each model with four threads. The Pi didn't like it and rebooted midway. I think four threads is fine on incidental loads, but for this exercise I scaled it down to two. Because token generation is not compute-bound, this means we're not going to see big improvements at four threads.

## Perplexity and Intelligence

An LLM generates a vector of probabilities for each possible token in its vocabulary, after which the model harness samples a token. Perplexity can be described as the "jaggedness" of these probabilities - a high perplexity indicates that the model offers many tokens as a likely candidate.

This benchmark was not very successful as not all models (via llama.cpp) compute perplexity, and if they do they sometimes end up being nonsensical (5578 for lfm2.5 is two orders of magnitude higher than the rest). Also, I have no idea if these numbers can be compared between models. 

The next benchmark I ran was an MCQ-like questionnaire to test common, real-world knowledge and intelligence. Models had to respond to 40 multiple choice questions such as:
```
{
    "question": "If it is raining, what do you need to stay dry?"
    "choices": [
        "Sunglasses", "Umbrella", "Gloves", "Fan"
    ], 
    "answer": 1  # answers can be 0, 1, 2 or 3
}
```

Both Smol models got a 0 score, but this is likely because answers were not extracted properly from the model output. These questions had four possible answers, so filling them out randomly would have given you a 10/40 score*:

| model | perplexity | mcq |
| --- | --- | --- |
| smollm2-135m-instruct | 37.27 | 0/40 (0%) |
| gemma-3-270m-it | - (no PPL reported) | 16/40 (40%) |
| lfm2.5-350m  | 5578.07 | 24/40 (60%) |
| granite-4.0-h-350m | 60.73 | 5/40 (12%) |
| smollm2-360m-instruct | 26.96 | 0/40 (0%) |
| falcon-h1-0.5b | 58.36 | 10/40 (25%) |
| qwen3-0.6b | 61.58 | 22/40 (55%) |
| qwen2.5-0.5b-instruct | 45.50 | 24/40 (60%) |
| qwen3.5-0.8b | - (no PPL reported) | 6/40 (15%) |

I'm not super impressed - these are not hard questions and reveal a lack of basic knowledge and reasoning.

<small>
(*) The answers in the questionnaire were not equally distributed between 0, 1, 2, 3, so a random guess would not yield a 10/40 score per se.
</small>


## Code review

A model can be large or small, but in the end the question remains - can they meaningfully contribute to everyday tasks?

I asked each model the question:

```
Review the following Python function that multiplies two numbers:

def mul(a, b):
    return a / b
```

This is what smollm2-135m-instruct returned:

```
Here's a Python function that multiplies two numbers:

def mul(a, b):
    return a * b
```

Not a definitive rejection of the function under review, but so far so good, keep going Smol!

```
This function uses the * operator to multiply the two numbers together, 
and the / operator to divide the result by the second number.

However, this function is not efficient for large numbers because it 
performs multiplication by long division. A more efficient approach 
would be to use the ** operator, which is more suitable for large numbers:

def mul(a, b):
    return a ** b
```

No Smol, no!

The other models did not fare any better, if returning anything at all. Unless I didn't set the test up properly, these models won't be reviewing code anytime soon.

## Conclusion and Future Work

Can you use a Raspberry Pi 3B+ as an agentic clanker? Likely not: they're too slow, don't hold a lot of context, and are not advanced enough to do any kind of intelligent work. Nevertheless, this is just an initial experiment - with some tweaking we might be able to increase token speed for example.

As I mentioned, I have a few Pis lying around. In parallel they might be able to run a larger, smarter model, although the speed is then capped not by memory but by network (around 200Mbps in real-world conditions, either Ethernet or WiFi).

There might also be some model architecture that optimizes for the 3B+ hardware, but I doubt the gains will be Earth shattering.

Finally, a proper agent harness could do wonders for model usability as it has done for the frontier models, but that is not an issue of pure inference.

Thank you for your `Q.K^T`!


## ADDENDUM
I used DeepSeek v4.1 to assist with model infrastructure, serving, and benchmark design.