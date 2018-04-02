import AWS from 'aws-sdk'
import BaseStore from 'ghost-storage-base'
import {
  join
} from 'path'
import Promise, {
  promisify
} from 'bluebird'
import {
  readFile
} from 'fs'

const readFileAsync = promisify(readFile)

const removeLeadingSlashes = str => str.indexOf('/') === 0 ? str.substring(1) : str

class DOStore extends BaseStore {
  constructor(config = {}) {
    super(config)

    AWS.config.setPromisesDependency(Promise)

    const {
      key,
      spaceUrl,
      bucket,
      subFolder,
      region,
      secret,
      endpoint
    } = config

    this.key = process.env.GHOST_DO_KEY || key
    this.secret = process.env.GHOST_DO_SECRET || secret
    this.region = process.env.GHOST_DO_REGION || region
    this.bucket = process.env.GHOST_DO_BUCKET || bucket
    this.spaceUrl = process.env.GHOST_DO_SPACE_URL || spaceUrl || `https://${this.bucket}.${this.region}.digitaloceanspaces.com/`
    this.subFolder = removeLeadingSlashes(process.env.GHOST_DO_SUBFOLDER || subFolder || '')
    this.endpoint = process.env.GHOST_DO_ENDPOINT || endpoint || ''
  }

  /**
   * Returns the AWS S3 library for the module functions.
   * 
   * @returns {*} s3 - The AWS S3 library for accessing Digital Ocean Spaces.
   */
  s3() {
    const options = {
      accessKeyId: this.key,
      bucket: this.bucket,
      region: this.region,
      secretAccessKey: this.secret
    }
    if (this.endpoint !== '') {
      options.endpoint = this.endpoint
    }
    return new AWS.S3(options)
  }

  /**
   * Used by the Base storage adapter to check whether a file exists or not.
   * 
   * @param {FILE_NAME} fileName - the name of the file which is being uploaded. 
   * @param {TARGET_DIR} targetDir - the target dir of the file name. This is optional, ensure you first check if a custom dir was passed, otherwise fallback to the default dir/location of files.
   * @returns {*} promise - A promise which resolves to true or false depending on whether or not the given image has already been stored.
   */
  exists(fileName, targetDir) {
    return new Promise((resolve, reject) => {
      return this.s3()
        .getObject({
          Bucket: this.bucket,
          Key: removeLeadingSlashes(join(targetDir, fileName))
        })
        .promise()
        .then(() => resolve(true))
        .catch(() => resolve(false))
    })
  }

  /**
   * Store the image and return a promise which resolves to the path from which the image should be requested in future.
   * 
   * @param {IMAGE} image - an image object with properties name and path
   * @param {TARGET_DIR} targetDir - a path to where to store the image. Example here: https://github.com/TryGhost/Ghost/blob/master/core/server/adapters/storage/LocalFileStorage.js#L35
   * @returns {*} promise - A promise which resolves to the full URI of the image, either relative to the blog or absolute.
   */
  save(image, targetDir) {
    const directory = targetDir || this.getTargetDir(this.subFolder)

    return new Promise((resolve, reject) => {
      Promise.all([
        this.getUniqueFileName(image, directory),
        readFileAsync(image.path)
      ]).then(([fileName, file]) => (
        this.s3()
        .putObject({
          ACL: 'public-read',
          Body: file,
          Bucket: this.bucket,
          CacheControl: `max-age=${30 * 24 * 60 * 60}`,
          ContentType: image.type,
          Key: removeLeadingSlashes(fileName)
        })
        .promise()
        .then(() => resolve(`${this.spaceUrl}/${fileName}`))
      )).catch(error => reject(error))
    })
  }

  /**
   * Ghost calls serve() as part of its middleware stack, and mounts the returned function as the middleware for serving images.
   * no arguments. Example implementation here: https://github.com/TryGhost/Ghost/blob/master/core/server/adapters/storage/LocalFileStorage.js#L80
   */
  serve() {
    return (req, res, next) => {
      this.s3()
        .getObject({
          Bucket: this.bucket,
          Key: removeLeadingSlashes(req.path)
        }).on('httpHeaders', function (statusCode, headers, response) {
          res.set(headers)
        })
        .createReadStream()
        .on('error', function (err) {
          res.status(404)
          next(err)
        })
        .pipe(res)
    }
  }

  /**
   * Delete the image and return a promise.
   * 
   * @param {FILE_NAME} fileName - the name of the file which is being deleted.
   * @param {TARGET_DIR} targetDir - a path to where to delete the image from.
   * @returns {*} promise
   */
  delete(fileName, targetDir) {
    const directory = targetDir || this.getTargetDir(this.subFolder)

    return new Promise((resolve, reject) => {
      return this.s3()
        .deleteObject({
          Bucket: this.bucket,
          Key: removeLeadingSlashes(join(directory, fileName))
        })
        .promise()
        .then(() => resolve(true))
        .catch(() => resolve(false))
    })
  }

  /**
   * Reads the file from digitalocean storage.
   * @param {OPTIONS} options - The config options used to read the file.
   */
  read(options) {
    options = options || {}

    return new Promise((resolve, reject) => {
      // remove trailing slashes
      let path = (options.path || '').replace(/\/$|\\$/, '')

      // check if path is stored in digitalocean handled by us
      if (!path.startsWith(this.spaceUrl)) {
        return reject(new Error(`${path} is not stored in digital ocean`))
      }

      path = path.substring(this.spaceUrl.length)

      this.s3()
        .getObject({
          Bucket: this.bucket,
          Key: removeLeadingSlashes(path)
        })
        .promise()
        .then((data) => resolve(data.Body))
        .catch(error => reject(error))
    })
  }
}

export default DOStore