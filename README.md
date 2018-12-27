# Ghost DigitalOcean Storage Adapter

A Digital Ocean storage adapter for Ghost 1.x and Ghost 2.x

## Installation

`cd` into the directory of your ghost installation and install the ghost digitalocean package by using the following command.

```shell
npm install ghost-digitalocean
```

Note: Check if `content/adapters/storage` path exists, if not, execute the following command:

```shell
mkdir -p ./content/adapters/storage
```

Note: Copy the module from `node_modules` by using the following command:

```shell
cp -r ./node_modules/ghost-digitalocean ./content/adapters/storage/digitalocean
```

## Configuration

You can configure the module using either one of the following options:

### A. Using config files

You need to include the configuration settings in your `config.development.json` or `config.production.json` file:
```json
"storage": {
    "active" : "digitalocean",
    "digitalocean" : {
        "key": "YOUR_DIGITALOCEAN_SPACES_KEY",
      "secret" : "YOUR_DIGITALOCEAN_SPACES_SECRET",
      "region" : "YOUR_DIGITALOCEAN_SPACES_REGION",
      "bucket": "YOUR_DIGITALOCEAN_SPACES_BUCKET",
      "spaceUrl": "YOUR_DIGITALOCEAN_SPACES_URL",
      "subFolder": "OPTIONAL_SUB_FOLDER_NAME",
      "endpoint" : "${REGION}.digitaloceanspaces.com"
    }
}
```

where `${REGION}` is the region that you have been allotted / selected for the digitalocean space.

Note: Be sure to include `"//"` or the appropriate protocol within your spaceUrl string/variable to ensure that your site's domain is not prepended to the SPACE URL.

For information on digitalocean spaces and how to generate them, please visit : [https://www.digitalocean.com/community/tutorials/an-introduction-to-digitalocean-spaces](https://www.digitalocean.com/community/tutorials/an-introduction-to-digitalocean-spaces)


### Or B. Using Environment Variables

You can also configure the module using environment variables:

```
GHOST_DO_KEY
GHOST_DO_SECRET
GHOST_DO_REGION
GHOST_DO_BUCKET
GHOST_DO_SPACE_URL  // optional
GHOST_DO_SUBFOLDER // optional
GHOST_DO_ENDPOINT // optional
```
