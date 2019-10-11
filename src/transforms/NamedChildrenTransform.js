/*
 *  Copyright 2017 Adobe Systems Incorporated. All rights reserved.
 *  This file is licensed to you under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License. You may obtain a copy
 *  of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under
 *  the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 *  OF ANY KIND, either express or implied. See the License for the specific language
 *  governing permissions and limitations under the License.
 *
 */

const t = require('babel-types');
const PathUtils = require('@twist/babel-plugin-transform/src/PathUtils');

function getName(name) {
  return `${name.object.name ? name.object.name : getName(name.object)}.${name.property.name}`;
}

module.exports = class NamedChildrenTransform {
    static apply(path) {
        t.assertJSXElement(path.node);
        const nameRoot = path.node.openingElement.name;
        let attrName;
        if (nameRoot.namespace) {
            if (t.isJSXElement(path.parent) && path.parent.openingElement.name.name === nameRoot.namespace.name) {
                attrName = nameRoot.name.name;
            }
        } else if (nameRoot.object) {
            const [ , attr ] = nameRoot.property.name.split('_');
            if (attr && t.isJSXElement(path.parent) && path.parent.openingElement.name.object && getName(nameRoot).startsWith(getName(path.parent.openingElement.name) + '_')) {
                attrName = attr;
            }
        }
        if (!attrName) {
            return false;
        }

        const nameAttr = PathUtils.getAttributeValue(path, 'name');
        attrName = !nameAttr ? attrName : nameAttr.value;
        let parentAttrs = path.parent.openingElement.attributes;

        // Check to see if we need to convert to a function
        path.node.children = traverse(path.node.children, path);
        let attrValue = PathUtils.jsxChildrenToJS(path.node.children);
        const args = PathUtils.stripAsIdentifiers(path);
        if (args && attrValue) {
            // Convert <Dialog:title as={ x }>...</Dialog:title> to a function: (x) => ...
            attrValue = t.arrowFunctionExpression(args, attrValue);
        }

        let existingAttr = PathUtils.getAttributeValue(path.parentPath, attrName);
        if (existingAttr && t.isJSXExpressionContainer(existingAttr)) {
            if (!t.isArrayExpression(existingAttr.expression)) {
                existingAttr.expression = t.arrayExpression([ existingAttr.expression ]);
            }
            existingAttr.expression.elements.push(attrValue);
        }
        else {
            parentAttrs.push(t.jSXAttribute(t.jSXIdentifier(attrName), t.jSXExpressionContainer(attrValue)));
        }

        path.remove();
        return true;
    }
};

function traverse(children, parentPath) {
    if (children.length) {
        children = children.filter(node => {
            const path = { type: node.type, node, parent: parentPath.node, parentPath, remove: () => 0 };
            switch (node.type) {
                case 'JSXElement':
                    node.children = traverse(node.children, path);
                    node = module.exports.apply(path) ? null : node;
                    break;
                case 'JSXExpressionContainer':
                    const { expression } = node;
                    switch (expression.type) {
                        case 'LogicalExpression':
                            const expressionNode = expression.right;
                            if (expressionNode.type === 'JSXElement') {
                                traverse([ expressionNode ], path);
                            }
                            break;
                        case 'ConditionalExpression':
                            const consequentNode = expression.consequent;
                            const alternateNode = expression.alternate;
                            if (consequentNode.type === 'JSXElement') {
                                traverse([ consequentNode ], path);
                            }
                            if (alternateNode.type === 'JSXElement') {
                                traverse([ alternateNode ], path);
                            }
                            break;
                        case 'CallExpression':
                            const expressionBody = expression.arguments[0] && expression.arguments[0].body;
                            if (expressionBody && expressionBody.type === 'JSXElement') {
                                traverse([ expressionBody ], path);
                            }
                            break;
                    }
                    break;
            }
            return node;
        });
    }
    return children
}
