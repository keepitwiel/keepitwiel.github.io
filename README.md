# Website of the keepitwiel organization

If you enjoy pain, look at pages.github.com on how to install Ruby/Jekyll and generate the HTML site from markdown files.

You will probably only need to do this once to generate a Gemfile.

Once you push to origin, Github takes care of the publishing.

Folder structure:

    /docs

Root folder (make sure to set this as root folder in the repo settings on Github)

    /docs/_posts

Folder with all blog posts (markdown files)

To serve the website locally, run this:

    bundle exec jekyll serve

and read the instructions. Most likely the website will show up at https://127.0.0.1:4000

To run the site locally at http://127.0.0.1:4000, use the included helper script from the repository root:

    bash serve_local.sh

What the script does:
- Installs gems (runs `bundle install` inside `docs`).
- Runs `bundle exec jekyll serve` bound to `127.0.0.1:4000`, watching for changes.

If you prefer to run Jekyll manually, you can use:

    cd docs
    bundle exec jekyll serve --host 127.0.0.1 --port 4000

Copyright (c) keepitwiel organization. All rights reserved.
