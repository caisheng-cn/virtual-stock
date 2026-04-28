/**
 * File: about.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: About API module. Provides a function to retrieve the application version information.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * getVersion
 * Description: GET /about — Retrieves the application version and related metadata.
 * @returns {Promise<Object>} Response containing version info
 */
export const getVersion = () => request.get('/about')