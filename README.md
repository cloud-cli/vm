# Docker volume management

## Usage

```
npm i @cloud-cli/vm
```

```js
// cloudy.conf.mjs

import volume from '@cloud-cli/vm';

export default { volume };
```

## API

**Create a volume**

```
cy volume.add --name "foo"
```

**Remove a volume**

```
cy volume.remove --name "foo"
```

**Get details of a volume**

```
cy volume.show --name "foo"
```

**List volumes**

```
cy volume.list
```

**Prune unused volumes**

```
cy volume.prune
```
