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

  read(options) {
    options = options || {}

    return new Promise((resolve, reject) => {
      // remove trailing slashes
      let path = (options.spaceUrl || '').replace(/\/$|\\$/, '')

      // check if path is stored in s3 handled by us
      if (!path.startsWith(this.spaceUrl)) {
        reject(new Error(`${path} is not stored in digital ocean`))
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