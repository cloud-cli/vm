# Docker volume management

## Usage

```
npm i @cloud-cli/vm
```

```js
// cloudy.conf.mjs

import volumes from "@cloud-cli/vm";

export default { volumes };
```

## API

**Create a volume**

```
cy volume.add --name "foo"
```

**Remove a volume**

```
cy proxy.remove --name "foo"
```

**Get details of a proxy**

```
cy proxy.get --domain "foo.example.com"
```

**List volumes**

```
cy proxy.list
```

**List registered domains**

```
cy proxy.domains
```

**Reload all configurations**

```
cy proxy.reload
```
