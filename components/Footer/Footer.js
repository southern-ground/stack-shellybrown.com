  /**
 * React Static Boilerplate
 * https://github.com/kriasoft/react-static-boilerplate
 *
 * Copyright © 2015-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react';
import Link from '../Link';

function Footer() {
  return (
    <footer className="mdl-mini-footer">
      <div className="mdl-mini-footer__left-section">
        <div className="mdl-logo">&copy;{new Date().getFullYear()} Shelly Brown</div>
      </div>
      <div className="mdl-mini-footer__right-section">

      </div>
    </footer>
  );
}

export default Footer;
